// --- Startup Logging for cPanel Debug ---
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'startup.log');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
    console.log(message);
}

// Clear old log on startup
fs.writeFileSync(LOG_FILE, `=== Server Starting at ${new Date().toISOString()} ===\n`);

log('Loading modules...');

try {
    const express = require('express');
    log('✓ express loaded');
    
    const http = require('http');
    log('✓ http loaded');
    
    const { Server } = require('socket.io');
    log('✓ socket.io loaded');
    
    const multer = require('multer');
    log('✓ multer loaded');
    
    const cron = require('node-cron');
    log('✓ node-cron loaded');
    
    const compression = require('compression');
    log('✓ compression loaded');
    
    const helmet = require('helmet');
    log('✓ helmet loaded');
    
    log('Loading database...');
    const db = require('./database');
    log('✓ database loaded');
    
    log('All modules loaded successfully!');

// --- Rest of the application wrapped in try-catch ---

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Configuration ---
const UPLOAD_DIR = path.join(__dirname, 'public/uploads');
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours
const DISCONNECT_GRACE_PERIOD = 5000; // 5 seconds wait before announcing leave

// Track users in rooms: { roomId: { userId: { id, nickname, socketId, ... } } }
// We track by userId now, not socket.id, to handle reconnects
const roomUsers = {}; 
// Map socketId to userId for easier lookup on disconnect
const socketToUser = {};
// Track pending timeouts for disconnects
const disconnectTimeouts = {};

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- Security & Performance Middleware ---
// Gzip compression for all responses
app.use(compression());

// Security headers (with adjustments for socket.io and inline scripts)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://ipapi.co"]
        }
    },
    crossOriginEmbedderPolicy: false // Required for socket.io
}));

// Static files with caching headers
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h', // Cache for 1 hour
    etag: true
}));
app.use(express.json());

// --- File Upload Setup (Multer) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- Routes ---

// Handle image upload API
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.json({ url: '/uploads/' + req.file.filename });
});

// API Stats
app.get('/api/stats', (req, res) => {
    const activeRooms = Object.keys(roomUsers).length;
    const activeUsers = Object.keys(socketToUser).length;
    res.json({ rooms: activeRooms, users: activeUsers });
});

// Serve the chat page for any room (must be after static and api routes)
app.get('/:room', (req, res) => {
    const room = req.params.room;
    if (room === 'api' || room.includes('.')) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// --- Helper Functions ---
function broadcastUserList(roomId) {
    if (!roomUsers[roomId]) return;
    const users = Object.values(roomUsers[roomId]).map(u => ({
        nickname: u.nickname,
        userId: u.userId
    }));
    io.to(roomId).emit('userList', users);
}

// --- Socket.io Logic ---
io.on('connection', (socket) => {
    
    socket.on('join', (roomId, nickname, userId) => {
        // userId is expected from client (generated if not exists)
        if (!userId) {
             // Fallback if client doesn't send one (backward compat), though client should.
             userId = 'anon_' + socket.id; 
        }

        socket.join(roomId);
        
        // Map socket to user
        socketToUser[socket.id] = { roomId, userId };

        // Initialize room if needed
        if (!roomUsers[roomId]) {
            roomUsers[roomId] = {};
        }

        const existingUser = roomUsers[roomId][userId];

        // Cancel any pending disconnect timeout for this user
        if (disconnectTimeouts[userId]) {
            clearTimeout(disconnectTimeouts[userId]);
            delete disconnectTimeouts[userId];
            // If we canceled a timeout, it means they reconnected quickly.
            // We just update their socket ID.
            if (existingUser) {
                existingUser.socketId = socket.id;
            }
        }

        // Add or update user to room
        roomUsers[roomId][userId] = {
            userId: userId,
            socketId: socket.id,
            nickname: nickname,
            joinedAt: existingUser ? existingUser.joinedAt : Date.now()
        };
        
        // Send history
        const messages = db.getMessages(roomId);
        socket.emit('history', messages);
        
        // Broadcast updated user list
        broadcastUserList(roomId);
        
        // ONLY send "User joined" if they weren't already in the room (e.g. fresh join)
        // If they were in `roomUsers` and we just canceled a timeout, it's a reconnect (F5), so stay silent.
        if (!existingUser) {
            io.to(roomId).emit('system', {
                type: 'join',
                nickname: nickname,
                timestamp: Date.now()
            });
            
            // Send room config to the joining user
            const expiry = db.getRoomExpiry(roomId) || 24;
            socket.emit('roomConfig', { expiry });
        } else {
            // Also send to reconnecting user
            const expiry = db.getRoomExpiry(roomId) || 24;
            socket.emit('roomConfig', { expiry });
        }
    });

    socket.on('message', (msgData) => {
        const { room, nickname, content, type, replyTo } = msgData;
        const timestamp = Date.now();
        
        const msg = {
            room_id: room,
            nickname,
            content: type === 'text' ? content : null,
            image_path: type === 'image' ? content : null,
            type,
            timestamp,
            replyTo: replyTo || null // Store reply reference
        };

        // Save to DB
        const savedMsg = db.addMessage(msg);
                
        // Broadcast
        io.to(room).emit('message', savedMsg);
    });

    socket.on('deleteMessage', (msgId) => {
        const user = socketToUser[socket.id];
        const room = user ? user.roomId : null;
        if (room) {
            const deletedMsg = db.deleteMessage(msgId);
            if (deletedMsg) {
                // If it was an image, delete the file
                if (deletedMsg.type === 'image' && deletedMsg.image_path) {
                    const relativePath = deletedMsg.image_path.startsWith('/') ? deletedMsg.image_path.substring(1) : deletedMsg.image_path;
                    const fullPath = path.join(__dirname, 'public', relativePath);
                    fs.unlink(fullPath, (err) => {
                         if (err && err.code !== 'ENOENT') console.error("Failed to delete file:", fullPath, err);
                    });
                }

                io.to(room).emit('messageDeleted', msgId);
            }
        }
    });

    socket.on('clearRoom', () => {
        const user = socketToUser[socket.id];
        const room = user ? user.roomId : null;
        if (room && db.clearRoom(room)) {
            io.to(room).emit('roomCleared');
            io.to(room).emit('system', {
                type: 'info',
                content: 'Chat history cleared.'
            });
        }
    });

    socket.on('clearUserMessages', () => {
        const user = socketToUser[socket.id];
        const room = user ? user.roomId : null;
        const userId = user ? user.userId : null;
        
        // user.roomId lookup is reliable, but nickname might need to be fetched from roomUsers
        if (room && userId && roomUsers[room] && roomUsers[room][userId]) {
            const nickname = roomUsers[room][userId].nickname;
            if (db.deleteMessagesByNickname(room, nickname)) {
                io.to(room).emit('userMessagesCleared', nickname);
            }
        }
    });
    
    // Typing indicator
    socket.on('typing', (isTyping) => {
        const user = socketToUser[socket.id];
        if (user) {
            const { roomId, userId } = user;
            const nickname = roomUsers[roomId] && roomUsers[roomId][userId] ? roomUsers[roomId][userId].nickname : null;
            if (nickname) {
                socket.to(roomId).emit('userTyping', {
                    nickname: nickname,
                    isTyping: isTyping
                });
            }
        }
    });

    socket.on('markRead', (msgId) => {
        const user = socketToUser[socket.id];
        const room = user ? user.roomId : null;
        if (room) {
            // In a real app we would update DB
            // db.markMessageRead(msgId, user.nickname);
            io.to(room).emit('messageRead', { msgId, reader: user.nickname });
        }
    });



    socket.on('setExpiry', (hours) => {
        const user = socketToUser[socket.id];
        if (user && user.roomId) {
             db.setRoomExpiry(user.roomId, hours);
             io.to(user.roomId).emit('roomConfig', { expiry: hours });
             // io.to(user.roomId).emit('system', { type: 'info', content: `Message expiry set to ${hours} hours` }); 
             // System message might be annoying if frequent, but good for feedback.
             // Let's rely on roomConfig update for UI.
        }
    });

    socket.on('disconnect', () => {
        const user = socketToUser[socket.id];
        if (user) {
            const { roomId, userId } = user;
            
            // Start Grace Period
            // We do NOT remove them immediately. We wait.
            disconnectTimeouts[userId] = setTimeout(() => {
                // If this runs, it means they didn't reconnect in time.
                // Now we actually remove them.
                
                if (roomUsers[roomId] && roomUsers[roomId][userId]) {
                    const nickname = roomUsers[roomId][userId].nickname;
                    
                    delete roomUsers[roomId][userId];
                    if (Object.keys(roomUsers[roomId]).length === 0) {
                        delete roomUsers[roomId];
                    } else {
                        broadcastUserList(roomId);
                        io.to(roomId).emit('system', {
                            type: 'leave',
                            nickname: nickname,
                            timestamp: Date.now()
                        });
                    }
                }
                
                delete disconnectTimeouts[userId];
            }, DISCONNECT_GRACE_PERIOD);

            // Clean up socket mapping immediately though, as this specific socket is dead.
            delete socketToUser[socket.id];
        }
    });
});

// --- Cleanup Cron Job ---
cron.schedule('0 * * * *', () => {
    console.log('Running auto-deletion task...');
    
    const deletedMessages = db.cleanup(RETENTION_MS);

    deletedMessages.forEach(msg => {
        if (msg.type === 'image' && msg.image_path) {
            const relativePath = msg.image_path.startsWith('/') ? msg.image_path.substring(1) : msg.image_path;
            const fullPath = path.join(__dirname, 'public', relativePath);
            
            fs.unlink(fullPath, (err) => {
                if (err && err.code !== 'ENOENT') console.error("Failed to delete file:", fullPath, err);
            });
        }
    });
});

// --- Start Server ---
// Use PORT env if provided, otherwise default to 3000
const PORT = process.env.PORT || 3000;

log(`Attempting to start server on port ${PORT}...`);

server.listen(PORT, () => {
    log(`✓ Server running on port ${PORT}`);
});

server.on('error', (err) => {
    log(`✗ Server error: ${err.message}`);
    log(err.stack);
});

} catch (err) {
    // This catches any errors during module loading or initialization
    log(`✗ FATAL ERROR: ${err.message}`);
    log(err.stack);
    process.exit(1);
}

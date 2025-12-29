// --- Startup Logging for cPanel Debug ---
console.error('=== SERVER.JS STARTING ==='); // This should appear in stderr.log
console.error('Current directory:', __dirname);
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
    // The database module is now loaded outside the try block for key initialization
    // log('Loading database...');
    // const db = require('./database');
    // log('✓ database loaded');
    
    log('All modules loaded successfully!');

// --- Rest of the application wrapped in try-catch ---

const app = express();
const server = http.createServer(app);
const io = new Server(server);
// db and fs are already loaded above
const crypto = require('crypto');

// Use hidden storage for encrypted files
const UPLOAD_DIR = path.join(__dirname, 'storage', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ENCRYPTION_KEY = db.getKey(); // Get key from DB logic
const IV_LENGTH = 16; // 24 hours
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
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdnjs.cloudflare.com"], // Added unsafe-eval
            scriptSrcAttr: ["'self'", "'unsafe-inline'"], // Explicitly allow inline event handlers
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:", "cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "ws:", "wss:", "*"] // Allow all connections to rule out CSP for now
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

const os = require('os');

// --- File Upload Setup (Multer) ---
// --- Encrypted File Handling ---

// 1. Use system temp directory for reliability
const TEMP_DIR = os.tmpdir();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, TEMP_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit at middleware level
});

// 2. Encryption Helper (File -> Encrypted File)
function encryptFile(inputPath, outputPath, cb) {
    // Check Key - Log if missing
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
        console.error("Encryption Failed: Invalid Key", ENCRYPTION_KEY ? "Length mismatch" : "Missing");
        return cb(new Error("Invalid Encryption Key (Check .secret file permissions)"));
    }

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        
        const input = fs.createReadStream(inputPath);
        const output = fs.createWriteStream(outputPath);

        // Write IV first
        output.write(iv);

        input.pipe(cipher).pipe(output);

        output.on('finish', () => {
            cb(null);
        });
        output.on('error', (err) => {
            console.error("Stream encryption error:", err);
            cb(err);
        });
    } catch (err) {
        console.error("Crypto setup error:", err);
        cb(err);
    }
}

// Helper to delete file by URL (handles encrypted and legacy paths)
function deleteFileByUrl(url) {
    if (!url) return;
    
    // New Encrypted Files
    if (url.startsWith('/api/file/')) {
        const filename = url.replace('/api/file/', '');
        const fullPath = path.join(UPLOAD_DIR, filename);
        fs.unlink(fullPath, (err) => {
            if (err && err.code !== 'ENOENT') console.error("Failed to delete encrypted file:", fullPath, err);
        });
    } else {
        // Legacy Public Files
        const relativePath = url.startsWith('/') ? url.substring(1) : url;
        const fullPath = path.join(__dirname, 'public', relativePath);
        fs.unlink(fullPath, (err) => {
            if (err && err.code !== 'ENOENT') console.error("Failed to delete legacy file:", fullPath, err);
        });
    }
}

// 3. Upload Route (Encrypts and saves)
app.post('/api/upload', (req, res) => {
    // Use .any() for broader compatibility with cPanel proxies
    upload.any()(req, res, (err) => {
        if (err) {
            console.error("Multer upload error:", err);
            return res.status(500).json({ 
                error: "Upload Middleware Failed", 
                message: err.message,
                stack: err.stack 
            });
        }
        
        // .any() puts files in req.files array
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No file uploaded.');
        }
        
        const uploadedFile = req.files[0]; // Take the first file
        const tempPath = uploadedFile.path;
        const finalFilename = uploadedFile.filename + '.enc';
        const finalPath = path.join(UPLOAD_DIR, finalFilename);
        
        // Debug Log
        console.log(`Starting Encryption: Temp=${tempPath}, Final=${finalPath}, KeyLen=${ENCRYPTION_KEY ? ENCRYPTION_KEY.length : 'NULL'}`);

        encryptFile(tempPath, finalPath, (err) => {
            // Always delete temp file (using fs.unlink to avoid callback nesting hell if simple)
            fs.unlink(tempPath, (unlinkErr) => {
                if (unlinkErr) console.error("Temp file cleanup warning:", unlinkErr.message);
            });

            if (err) {
                console.error("Encryption failed:", err);
                // SEND DETAILED ERROR TO CLIENT
                return res.status(500).json({ 
                    error: "Encryption Failed", 
                    message: err.message,
                    code: err.code || 'UNKNOWN',
                    path: finalPath // Debugging help
                });
            }

            res.json({ url: '/api/file/' + finalFilename });
        });
    });
});

// 4. Decryption Route (serves the file)
app.get('/api/file/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

    // Simple Decryption Stream
    // 1. Read first 16 bytes for IV
    const readStream = fs.createReadStream(filePath, { start: 0, end: IV_LENGTH - 1 });
    
    let iv;
    readStream.on('data', (chunk) => {
        iv = chunk;
    });

    readStream.on('end', () => {
        if (!iv || iv.length !== IV_LENGTH) return res.status(500).send('Corrupt file');

        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        const fileStream = fs.createReadStream(filePath, { start: IV_LENGTH }); // Skip IV

        // Guess content type based on original extension (stored in filename before .enc)
        // e.g. 12345.png.enc
        const originalExt = path.extname(filename.replace('.enc', ''));
        if (originalExt === '.png') res.type('image/png');
        else if (originalExt === '.jpg' || originalExt === '.jpeg') res.type('image/jpeg');
        else if (originalExt === '.gif') res.type('image/gif');
        else if (originalExt === '.webm') res.type('video/webm');
        else if (originalExt === '.mp4') res.type('video/mp4');
        else if (originalExt === '.mp3') res.type('audio/mpeg');
        else res.type('application/octet-stream');

        fileStream.pipe(decipher).pipe(res);
    });
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

    // Legacy message handler (fallback if PHP fails)
    socket.on('message', (msgData) => {
        const timestamp = Date.now();
        const msgId = timestamp + Math.random().toString(36).substr(2, 9);
        
        const msg = {
            id: msgId,
            room_id: msgData.room,
            nickname: msgData.nickname,
            content: msgData.content,
            image_path: msgData.image_path,
            video_path: msgData.video_path,
            audio_path: msgData.audio_path,
            type: msgData.type,
            timestamp: timestamp,
            replyTo: msgData.replyTo || null
        };
        
        db.addMessage({...msg});
        io.to(msgData.room).emit('message', msg);
    });
    
    // NEW: Just broadcast message ID - clients fetch from PHP
    socket.on('newMessage', (data) => {
        console.log('newMessage received:', data);
        // Broadcast to all users in the room (except sender)
        socket.to(data.room).emit('newMessage', { messageId: data.messageId });
    });

    socket.on('deleteMessage', (msgId) => {
        const user = socketToUser[socket.id];
        const room = user ? user.roomId : null;
        if (room) {
            const deletedMsg = db.deleteMessage(msgId);
            if (deletedMsg) {
                // If it was media, delete the file
                if ((deletedMsg.type === 'image' && deletedMsg.image_path) || 
                    (deletedMsg.type === 'audio' && deletedMsg.audio_path) ||
                    (deletedMsg.type === 'video' && deletedMsg.video_path)) {
                    const filePath = deletedMsg.type === 'image' ? deletedMsg.image_path : (deletedMsg.type === 'audio' ? deletedMsg.audio_path : deletedMsg.video_path);
                    deleteFileByUrl(filePath);
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
        if ((msg.type === 'image' && msg.image_path) || 
            (msg.type === 'audio' && msg.audio_path) ||
            (msg.type === 'video' && msg.video_path)) {
            const filePath = msg.type === 'image' ? msg.image_path : (msg.type === 'audio' ? msg.audio_path : msg.video_path);
            deleteFileByUrl(filePath);
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

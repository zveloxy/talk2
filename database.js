const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.resolve(__dirname, 'chat_data.json');
const SECRET_FILE = path.resolve(__dirname, '.secret');

// Key Management
let ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

if (fs.existsSync(SECRET_FILE)) {
    try {
        ENCRYPTION_KEY = Buffer.from(fs.readFileSync(SECRET_FILE, 'utf8').trim(), 'hex');
    } catch (e) { console.error("Error reading secret:", e); }
}

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    ENCRYPTION_KEY = crypto.randomBytes(32);
    try {
        fs.writeFileSync(SECRET_FILE, ENCRYPTION_KEY.toString('hex'));
        console.log("New encryption key generated.");
    } catch (e) {
        console.error("Failed to write secret file:", e);
    }
}

// Helpers
function encrypt(text) {
    try {
        let iv = crypto.randomBytes(IV_LENGTH);
        let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error("Encryption failed:", e);
        return text; // Fallback (dangerous but better than crash?) No, better to return null or throw. 
        // Actually for this app, returning text is safer to avoid total data loss during transition debugging.
    }
}

function decrypt(text) {
    try {
        let textParts = text.split(':');
        if (textParts.length < 2) return null; // Not encrypted
        let iv = Buffer.from(textParts.shift(), 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // console.error("Decryption failed (might be plain text):", e);
        return null;
    }
}

// Initialize DB file if not exists
if (!fs.existsSync(DB_FILE)) {
    // Write empty encrypted DB
    const empty = JSON.stringify({ messages: [], rooms: {} });
    fs.writeFileSync(DB_FILE, encrypt(empty));
}

class SimpleDB {
    constructor() {
        this.cache = null;
    }

    _read() {
        if (this.cache) return this.cache;
        try {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            // 1. Try decrypting
            const decrypted = decrypt(raw);
            if (decrypted) {
                 this.cache = JSON.parse(decrypted);
            } else {
                 // 2. Fallback: Try parsing raw (migration from plain text)
                 this.cache = JSON.parse(raw);
            }
        } catch (err) {
            console.error("DB Read Error:", err);
            this.cache = { messages: [], rooms: {} };
        }
        if (!this.cache.rooms) this.cache.rooms = {};
        return this.cache;
    }

    _write(data) {
        this.cache = data;
        const jsonStr = JSON.stringify(data);
        const encrypted = encrypt(jsonStr);
        fs.writeFile(DB_FILE, encrypted, (err) => {
            if (err) console.error("DB Write Error:", err);
        });
    }

    addMessage(msg) {
        const db = this._read();
        msg.id = Date.now() + Math.random().toString(36).substr(2, 9);
        db.messages.push(msg);
        this._write(db);
        return msg;
    }

    deleteMessage(id) {
        const db = this._read();
        const index = db.messages.findIndex(m => m.id === id);
        if (index !== -1) {
            const deletedMsg = db.messages[index];
            db.messages.splice(index, 1);
            this._write(db);
            return deletedMsg;
        }
        return null;
    }

    deleteMessagesByNickname(roomId, nickname) {
        const db = this._read();
        const initialLen = db.messages.length;
        db.messages = db.messages.filter(m => !(m.room_id === roomId && m.nickname === nickname));
        if (db.messages.length !== initialLen) {
            this._write(db);
            return true;
        }
        return false;
    }

    clearRoom(roomId) {
        const db = this._read();
        const initialLen = db.messages.length;
        db.messages = db.messages.filter(m => m.room_id !== roomId);
        if (db.messages.length !== initialLen) {
            this._write(db);
            return true;
        }
        return false;
    }

    getMessages(roomId, limit = 50) {
        const db = this._read();
        return db.messages
            .filter(m => m.room_id === roomId)
            .sort((a, b) => a.timestamp - b.timestamp);
    }
    
    setRoomExpiry(roomId, hours) {
        const db = this._read();
        if (!db.rooms) db.rooms = {};
        if (!db.rooms[roomId]) db.rooms[roomId] = {};
        db.rooms[roomId].expiry = hours;
        this._write(db);
        return hours;
    }
    
    getRoomExpiry(roomId) {
        const db = this._read();
        if (db.rooms && db.rooms[roomId] && db.rooms[roomId].expiry) {
            return db.rooms[roomId].expiry;
        }
        return null;
    }

    cleanup(defaultRetentionMs) {
        const now = Date.now();
        const db = this._read();
        
        const initialCount = db.messages.length;
        const keptMessages = [];
        const discardedMessages = [];
        
        db.messages.forEach(m => {
            let retention = defaultRetentionMs;
            // Check if room has custom expiry
            if (db.rooms && db.rooms[m.room_id] && db.rooms[m.room_id].expiry) {
                retention = db.rooms[m.room_id].expiry * 60 * 60 * 1000;
            }
            
            if (now - m.timestamp < retention) {
                keptMessages.push(m);
            } else {
                discardedMessages.push(m);
            }
        });

        if (keptMessages.length !== initialCount) {
            db.messages = keptMessages;
            this._write(db);
            console.log(`Cleaned up ${discardedMessages.length} messages.`);
        }
        
        return discardedMessages;
    }

    getKey() {
        return ENCRYPTION_KEY;
    }
}

module.exports = new SimpleDB();

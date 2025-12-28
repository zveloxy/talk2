const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, 'chat_data.json');

// Initialize DB file if not exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ messages: [] }));
}

class SimpleDB {
    constructor() {
        this.cache = null;
    }

    _read() {
        if (this.cache) return this.cache;
        try {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            this.cache = JSON.parse(data);
        } catch (err) {
            console.error("DB Read Error:", err);
            this.cache = { messages: [], rooms: {} };
        }
        if (!this.cache.rooms) this.cache.rooms = {};
        return this.cache;
    }

    _write(data) {
        this.cache = data;
        fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
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
}

module.exports = new SimpleDB();

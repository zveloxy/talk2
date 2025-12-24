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
            this.cache = { messages: [] };
        }
        return this.cache;
    }

    _write(data) {
        this.cache = data;
        // Async write to avoid blocking too much, but for safety in this demo sync is fine or simplistic async
        fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
            if (err) console.error("DB Write Error:", err);
        });
    }

    addMessage(msg) {
        const db = this._read();
        // Add ID
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
            return deletedMsg; // Return the full object
        }
        return null; // Return null if not found
    }

    deleteMessagesByNickname(roomId, nickname) {
        const db = this._read();
        const initialLen = db.messages.length;
        db.messages = db.messages.filter(m => !(m.room_id === roomId && m.nickname === nickname));
        
        if (db.messages.length !== initialLen) {
            this._write(db);
            return true; // Messages were deleted
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
            .sort((a, b) => a.timestamp - b.timestamp); // Oldest first for chat history
    }

    cleanup(retentionMs) {
        const cutoff = Date.now() - retentionMs;
        const db = this._read();
        
        const initialCount = db.messages.length;
        
        // Filter messages to keep
        const keptMessages = [];
        const discardedMessages = [];
        
        db.messages.forEach(m => {
            if (m.timestamp > cutoff) {
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
        
        return discardedMessages; // Return deleted msgs to check for file deletion
    }
}

module.exports = new SimpleDB();

const db = require('./database');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENCRYPTION_KEY = db.getKey();
console.log("Key available:", !!ENCRYPTION_KEY);
if (ENCRYPTION_KEY) console.log("Key length:", ENCRYPTION_KEY.length);

const IV_LENGTH = 16;
const TEMP_DIR = path.join(__dirname, 'test_temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const testFile = path.join(TEMP_DIR, 'test.txt');
const outFile = path.join(TEMP_DIR, 'test.enc');
fs.writeFileSync(testFile, 'Hello World');

console.log("Starting encryption test...");
try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    
    const input = fs.createReadStream(testFile);
    const output = fs.createWriteStream(outFile);

    output.write(iv);
    input.pipe(cipher).pipe(output);

    output.on('finish', () => {
        console.log("Encryption success!");
        process.exit(0);
    });
    output.on('error', (err) => {
        console.error("Encryption stream error:", err);
        process.exit(1);
    });
} catch (e) {
    console.error("Encryption setup error:", e);
    process.exit(1);
}

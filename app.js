// Simple test file for cPanel - app.js
// If this works, we know Node.js is running

const http = require('http');
const fs = require('fs');
const path = require('path');

// Write log immediately on startup
const logFile = path.join(__dirname, 'debug.log');
fs.writeFileSync(logFile, 'App started at: ' + new Date().toISOString() + '\n');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    fs.appendFileSync(logFile, 'Request received: ' + req.url + '\n');
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
            <h1>✅ Node.js Çalışıyor!</h1>
            <p>Port: ${PORT}</p>
            <p>Time: ${new Date().toISOString()}</p>
            <p>Node Version: ${process.version}</p>
        </body>
        </html>
    `);
});

server.listen(PORT, () => {
    fs.appendFileSync(logFile, 'Server listening on port: ' + PORT + '\n');
    console.log('Server running on port ' + PORT);
});

server.on('error', (err) => {
    fs.appendFileSync(logFile, 'ERROR: ' + err.message + '\n');
});

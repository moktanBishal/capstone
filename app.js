const http = require('http');
const path = require('path');
const send = require('send');
const { handleWebSocketConnection } = require('./websocketHandler');

// Create HTTP server
const server = http.createServer((req, res) => {
    const requestedFilePath = req.url === '/' ? path.join(__dirname, 'chat.html') : path.join(__dirname, req.url);
    send(req, requestedFilePath)
        .on('error', (err) => {
            console.error(err);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        })
        .pipe(res);
});

// Initialize WebSocket connection handler
handleWebSocketConnection(server);

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}/`);
});

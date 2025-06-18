const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const customBadWords = require('./badwords.js'); // filepath: c:\Users\fionn\Desktop\truth\chat_room\class_9\server.js

const app = express();
const server = http.createServer(app)
const io = socketIo(server);

// Example blocklist
const blocklist = [
    '',  // Replace with actual IPs you want to block
];

const ipToUsername = {
    "172.17.0.41": "Moderator",
    "1": "Admin"
};

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    const userIp = socket.request.connection.remoteAddress.replace(/^.*:/, '');
    console.log(`User connected with IP: ${userIp}`);

    if (blocklist.includes(userIp)) {
        console.log(`User with IP: ${userIp} is banned and will be disconnected`);
        socket.disconnect();
        return;
    }

    // Store username for this socket
    let username = ipToUsername[userIp] || null;

    socket.on('send name', (requestedName) => {
        // If IP is mapped, override username
        if (ipToUsername[userIp]) {
            username = ipToUsername[userIp];
        } else {
            const containsBadWord = customBadWords.some(word =>
                requestedName.toLowerCase().includes(word)
            );
            if (containsBadWord) {
                socket.emit('send name', 'Username contains profanity and has been blocked.');
                return;
            }
            username = requestedName;
        }
        io.emit('send name', username);
    });

    socket.on('send message', (message) => {
        const containsBadWord = customBadWords.some(word =>
            message.toLowerCase().includes(word)
        );
        if (containsBadWord) {
            socket.emit('send message', 'Message contains profanity and has been blocked.');
            return;
        }
        io.emit('send message', message);
    });
});

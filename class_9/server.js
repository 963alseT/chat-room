const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const customBadWords = require('./badwords.js'); // filepath: c:\Users\fionn\Desktop\truth\chat_room\class_9\server.js

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cookieParser());
app.use(express.static('/'));

app.get('/', (req, res) => {
    let userId = req.cookies.userId;
    if (!userId) {
        userId = uuidv4();
        res.cookie('userId', userId, { maxAge: 10 * 365 * 24 * 60 * 60 * 1000 }); // 10 years
    }
    res.sendFile(__dirname + '/public/index.html');
});

// Add your admin UUIDs here
const adminUserIds = [
    'e3a245a8-2c8d-41d6-9a9d-c623f9a23f0b',
    'cc971d3a-a244-4475-af28-78da051daa38'
];

const mutedUsers = {};
const usernameToId = {};
const idToUsername = {};

function muteUser(identifier, durationSeconds) {
    const muteUntil = Date.now() + durationSeconds * 1000;
    mutedUsers[identifier] = muteUntil;
}

function isMuted(identifier) {
    return mutedUsers[identifier] && mutedUsers[identifier] > Date.now();
}

io.on('connection', (socket) => {
    // Parse cookie from socket handshake
    let userId = null;
    const cookies = socket.handshake.headers.cookie;
    if (cookies) {
        const match = cookies.match(/userId=([a-zA-Z0-9\-]+)/);
        if (match) {
            userId = match[1];
        }
    }
    if (!userId) {
        // Should not happen, but fallback: generate temporary UUID (not persistent)
        userId = uuidv4();
    }
    let username = idToUsername[userId] || null;
    console.log({ userId });

    socket.on('send name', (requestedName) => {
        if (isMuted(userId) || (username && isMuted(username))) {
            socket.emit('send name', 'You are on a timeout and cannot change your username right now.');
            return;
        }
        if (idToUsername[userId]) {
            username = idToUsername[userId];
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
        usernameToId[username] = userId; // Save mapping
        idToUsername[userId] = username;
        io.emit('send name', username);
    });

    socket.on('send message', (message) => {
        // Mute command: /mute username seconds
        if (message.startsWith('/mute ')) {
            if (!adminUserIds.includes(userId)) {
                socket.emit('send message', 'You do not have permission to use this command.');
                return;
            }
            const parts = message.split(' ');
            if (parts.length === 3) {
                const targetUsername = parts[1];
                const seconds = parseInt(parts[2]);
                const targetId = usernameToId[targetUsername];
                if (targetId && !isNaN(seconds)) {
                    muteUser(targetId, seconds);
                    socket.emit('send message', `Muted ${targetUsername} for ${seconds} seconds.`);
                } else {
                    socket.emit('send message', 'Mute command failed: user not found or invalid time.');
                }
                return;
            }
        }

        const containsBadWord = customBadWords.some(word =>
            message.toLowerCase().includes(word)
        );
        if (containsBadWord) {
            socket.emit('send message', 'Message contains profanity and has been blocked.');
            return;
        }
        if (isMuted(userId) || (username && isMuted(username))) {
            socket.emit('send message', 'You are on a timeout and cannot send messages right now.');
            return;
        }
        io.emit('send message', message);
    });
});

server.listen(5000, () => {
    console.log('listening on *:5000');
});





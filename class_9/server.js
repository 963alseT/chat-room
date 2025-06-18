const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const customBadWords = require('./badwords.js'); // filepath: c:\Users\fionn\Desktop\truth\chat_room\class_9\server.js

const app = express();
const server = http.createServer(app)
const io = socketIo(server);

const blocklist = [
    '',
];

const ipToUsername = {
    "172.17.0.41": "Moderator",
    "1": "Admin"
};

const adminIps = [
    "172.17.0.41", // Add your admin IPs here
    "1"
];

const mutedUsers = {};

function muteUser(identifier, durationSeconds) {
    const muteUntil = Date.now() + durationSeconds * 1000;
    mutedUsers[identifier] = muteUntil;
}

function isMuted(identifier) {
    return mutedUsers[identifier] && mutedUsers[identifier] > Date.now();
}

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const usernameToIp = {};

io.on('connection', (socket) => {
    const userIp = socket.request.connection.remoteAddress.replace(/^.*:/, '');
    let username = ipToUsername[userIp] || null;
    console.log({userIp})

    socket.on('send name', (requestedName) => {
        if (isMuted(userIp) || (username && isMuted(username))) {
        socket.emit('send name', 'You are on a timeout and cannot change your username right now.');
        return;
    }
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
        usernameToIp[username] = userIp; // Save mapping
        io.emit('send name', username);
    });

    socket.on('send message', (message) => {
    // Mute command: /mute username seconds
    if (message.startsWith('/mute ')) {
        if (!adminIps.includes(userIp)) {
            socket.emit('send message', 'You do not have permission to use this command.');
            return;
        }
        const parts = message.split(' ');
        if (parts.length === 3) {
            const targetUsername = parts[1];
            const seconds = parseInt(parts[2]);
            const targetIp = usernameToIp[targetUsername];
            if (targetIp && !isNaN(seconds)) {
                muteUser(targetIp, seconds);
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
        if (isMuted(userIp) || (username && isMuted(username))) {
            socket.emit('send message', 'You are on a timeout and cannot send messages right now.');
            return;
        }
        io.emit('send message', message);
    });
});

server.listen(5000, () => {
    console.log('listening on *:5000');
});
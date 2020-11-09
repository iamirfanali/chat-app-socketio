const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));

io.on('connection', (socket) => {
	console.log('New web socket connection');

	socket.on('join', ({ username, room }, callback) => {
		const { error, user } = addUser({ id: socket.id, username, room });

		if (error) {
			return callback(error);
		}

		socket.join(user.room);

		socket.emit('message', {
			text: 'Welcome',
			username: 'Admin',
			createdAt: new Date().getTime(),
		});

		socket.broadcast.to(user.room).emit('message', {
			username: 'Admin',
			text: `${user.username} has joined!`,
			createdAt: new Date().getTime(),
		});

		io.to(user.room).emit('roomData', {
			room: user.room,
			users: getUsersInRoom(user.room),
		});

		callback();
	});

	socket.on('sendMessage', (message, callback) => {
		const user = getUser(socket.id);

		const filter = new Filter();
		if (filter.isProfane(message)) {
			return callback('Profanity is not allowed!');
		}

		io.to(user.room).emit('message', {
			text: message,
			username: user.username,
			createdAt: new Date().getTime(),
		});
		callback();
	});

	socket.on('sendLocation', (coords, callback) => {
		const user = getUser(socket.id);

		io.to(user.room).emit('locationMessage', {
			username: user.username,
			url: `https://google.com/maps?q=${coords.latitude},${coords.longitude}`,
			createdAt: new Date().getTime(),
		});
		callback('Location shared!');
	});

	socket.on('disconnect', () => {
		const user = removeUser(socket.id);

		if (user) {
			io.to(user.room).emit('message', {
				username: 'Admin',
				text: `${user.username} has left!`,
				createdAt: new Date().getTime(),
			});
			io.to(user.room).emit('roomData', {
				room: user.room,
				users: getUsersInRoom(user.room),
			});
		}
	});
});

server.listen(port, () => {
	console.log('Server is up on port ' + port);
});

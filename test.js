const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const session = require('express-session');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var MemoryStore = require('memorystore')(session);
var store = new MemoryStore({
	checkPeriod: 86400000,
});
var Emitter = require('events');
var event = new Emitter();

app.use(session({
	secret: "my-secret",
	resave: true,
	saveUninitialized: true,
	store: store,
	cookie: {maxAge: 86400000},
}));

let connections = {
	users: {},
};

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/guest/:id', (req, res) => {
	event.emit('message', {
		socket: req.params.id,
		message: 'test',
		code: req.query.code || 'default',
	});
	res.send('ok');
});

app.get('/user/:id', (req, res) => {
	if (req.params.id && connections && connections.users && connections.users[req.params.id]) {
		if (req.query.code === 'default') {
			for (let item of connections.users[req.params.id]) {
				io.to(item).emit('message', 'jopa');
			}
			res.send('ok');
		}
		else {
			res.send('not valid secret');
		}
	}
	else {
		res.send('error');
	}
	
});

app.get('/all', (req, res, next) => {
	res.send(connections);
});

app.get('/login', (req, res, next) => {
	// // console.log(cookie.parse(req.headers.cookie).io);
	req.session.user = 'vasya';
	req.session.save();
	res.redirect('/');
});

app.get('/logout', (req, res, next) => {
	// console.log(cookie.parse(req.headers.cookie).io);
	// // delete connections.users[req.session.user];
	req.session.destroy();
	res.redirect('/');
});

event.on('join', (socket) => {
	var sessionCookie = cookie.parse(socket.handshake.headers.cookie);
	var sessionID = cookieParser.signedCookie(sessionCookie['connect.sid'], "my-secret");
	
	store.get(sessionID, (err, sessionData) => {
		if (!err) {
			if (sessionData && sessionData.user) {
				if (!connections.users[sessionData.user]) {
					connections.users[sessionData.user] = [];
				}
				
				connections.users[sessionData.user].push(socket.id);
			}
		}
	});
});

event.on('left', (socket) => {
	var sessionCookie = cookie.parse(socket.handshake.headers.cookie);
	var sessionID = cookieParser.signedCookie(sessionCookie['connect.sid'], "my-secret");
	
	store.get(sessionID, (err, sessionData) => {
		if (!err) {
			if (sessionData && sessionData.user) {
				if (connections && connections.users && connections.users[sessionData.user] && connections.users[sessionData.user].length) {
					let newArr = [];
					
					for (let item of connections.users[sessionData.user]) {
						if (item !== socket.id) {
							newArr.push(item);
						}
					}
					
					if (newArr && newArr.length) {
						delete connections.users[sessionData.user];
					}
					else {
						connections.users[sessionData.user] = newArr;
					}
				}
			}
		}
	});
});

io.on('connection', (socket) => {
	event.emit('join', socket);
	socket.on('disconnect', () => event.emit('left', socket));
});

http.listen(4000, () => {
	console.log('listening on *:4000');
});

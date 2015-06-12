var express 	= require('express'),
	app			= express(),
    server  	= require('http').createServer(app),
    io      	= require('socket.io').listen(server);

app.set('port', process.env.PORT || 3000);
app.set('ipaddr', process.env.IP);
app.use(express.static(__dirname + '/public'));
app.use('js', express.static(__dirname + '/js'));
app.use('css', express.static(__dirname + '/css'));
app.use('fonts', express.static(__dirname + '/fonts'));

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

server.listen(app.get('port'), app.get('ipaddr'), function(){
	console.log('Express server listening on  IP: ' + app.get('ipaddr') + ' and port ' + app.get('port'));
});

var clients = new Array();
var rooms = new Array();
var sockets = new Array();
var temp = false;

io.sockets.on("connection", function (socket) {

	socket.on("login", function(name){
		login(socket, name);
	});

	socket.on("list-rooms", function(){
		listRooms(socket);
	});

	socket.on("send", function(currentRoom, time, message){
		var re = /^[@].*\s.*/;
		var match = re.test(message);
		if(match){
			sendPrivateMessage(socket, time, message);
		} else {
			sendMessageToUserRoom(socket, clients[socket.id], currentRoom, time, message);
		}

	});

	socket.on("leave-room", function(currentRoom){
		leaveRoom(socket, currentRoom);
	});

	socket.on("disconnect", function(){
		if (typeof clients[socket.id] !== "undefined") {
			delete clients[socket.id];
		}
	});

	socket.on("delete-room", function(roomName){
		deleteRoom(socket, roomName);
	});

	socket.on("join-room", function(roomName){
		joinRoom(socket, roomName);
	});

	socket.on("create-room", function(roomName){
		createRoom(socket, roomName);
	});

	socket.on("online", function(){
		sendOnlineClients(socket);
	});

});

function login(socket, username){
	var exists = checkUserExistence(username);
	if (exists !== null) {
		socket.emit("error-login", "Username already in use.");
	} else {
		var status = createAndJoinRoom(socket, username, "new");
		if(status){
			clients[socket.id] = { id : socket.id, name : username };
			sockets[socket.id] = socket;
			socket.emit("success-login", {data : clients[socket.id]});
		} else {
			socket.emit("error-login", "Room already exists.");
		}
	}
}

function checkUserExistence(name){
	var keys = Object.keys(clients);
	for(var i=0; i<keys.length; i++){
		if(clients[keys[i]].name === name){
			return clients[keys[i]];
			break;
		}
	}
	return null;
}

function createAndJoinRoom(socket, username, type){
	var exists = checkRoomExistence(username);
	
	if(!exists){
		socket.broadcast.emit("update", "New Room Created : "+ username);
		socket.join(username+"~~~"+username);
		return true;
	} else {
		return false;
	} 	
}

function checkRoomExistence(name){
	var keys = getRooms();
	if(keys.indexOf(name)<0){
		return false;		
	}
	return true;
}

function listRooms(socket){

	socket.emit("room-list", {data : getRooms()});	
}

function getRooms(){
	var format = /[a-zA-Z0-9]+~~~.[a-zA-Z0-9]+/;
	var rooms = [];
	var Clients = Object.keys(io.sockets.adapter.rooms);
	for(var i=0; i<Clients.length; i++){
		var match = format.test(Clients[i]);
		if(match){
			rooms.push(Clients[i].split("~~~")[1]);
		}
	}
	return rooms;
}

function sendMessageToUserRoom(socket, client, currentRoom, time, message){
	var fullRoomName = getFullRoomName(currentRoom);
	if(fullRoomName !== null){
		io.sockets.in(fullRoomName).emit("message", {from : client.name, on : time, msg : message});
	} else {
		socket.emit("chat-error", "No room with room name " + currentRoom + " exists.");
	}
}

function getFullRoomName(roomName){
	var format = /[a-zA-Z0-9]+~~~.[a-zA-Z0-9]+/;
	var rooms = [];
	var Clients = Object.keys(io.sockets.adapter.rooms);
	for(var i=0; i<Clients.length; i++){
		var match = format.test(Clients[i]);
		if(match){
			if(roomName === Clients[i].split("~~~")[1]){
				return Clients[i];
			}
		}
	}
	return null;
}

function leaveRoom(socket, currentRoom){
	var clientName = clients[socket.id].name;
	var roomFullName = getFullRoomName(currentRoom);
	if(roomFullName !== null) {
		var roomOwnerName = roomFullName.split("~~~")[0];
		if(clientName === roomOwnerName){
			socket.broadcast.in(roomFullName).emit("force-leave-room");
			forceClientsToLeave(roomFullName, io.sockets.adapter.rooms[roomFullName]);
			socket.emit("room-left-admin");
			io.sockets.emit("update", "Room : " + currentRoom + " deleted.");
		} else {
			sendMessageToUserRoom(socket, clients[socket.id], currentRoom, new Date().getTime(), "left the room");
			socket.leave(roomFullName);
			io.sockets.in(roomFullName).emit("update", clientName + " left the room.");
			socket.emit("room-left");
		}
	} else {
		socket.emit("chat-error", "No room with room name " + currentRoom + " exists.");
	}
}

function deleteRoom(socket, roomName){
	var clientName = clients[socket.id].name;
	var roomFullName = getFullRoomName(roomName);
	if(clientName === roomFullName.split("~~~")[0]){
		socket.broadcast.in(roomFullName).emit("force-leave-room");
		forceClientsToLeave(roomFullName, io.sockets.adapter.rooms[roomFullName]);
		socket.emit("room-left-admin");
		io.sockets.emit("update", "Room : " + roomName + " deleted.");
	} else {
		socket.emit("chat-error", "Only room admin can delete room.");
	}
}

function forceClientsToLeave(fullRoomName, Clients){
	var ids = Object.keys(Clients);
	for(var i=0; i<ids.length; i++){
		sockets[ids[i]].leave(fullRoomName);
	}
}

function joinRoom(socket, roomName){
	var roomFullName = getFullRoomName(roomName);
	if(roomFullName === null){
		socket.emit("error-join");
	} else {
		socket.join(roomFullName);
		socket.broadcast.in(roomFullName).emit("update", clients[socket.id].name + " joined the room.");
		socket.emit("success-join");
	} 
}

function createRoom(socket, roomName){
	var roomFullName = getFullRoomName(roomName);
	console.log(roomFullName);
	if(roomFullName === null){
		socket.join(clients[socket.id].name + "~~~" + roomName);
		socket.broadcast.emit("update", "New Room Created : "+ roomName);
		sendMessageToUserRoom(socket, clients[socket.id], roomName, new Date().getTime(), "Welcome to " + roomName);
		socket.emit("success-create", roomName);	
	} else {
		socket.emit("error-create");
	}
}

function sendPrivateMessage(socket, time, message){
	var msgParts = message.split(" ");
	var to  = msgParts[0].split("@")[1];
	if(clients[socket.id].name === to){
		socket.emit("chat-error", "Cannot send private message to yourself");
	} else {
		var client = checkUserExistence(to);

		if(client !== null){
			sockets[client.id].emit("private-message", { from : clients[socket.id].name, on : time, msg : message});
			socket.emit("success-private", { too : to, on : time, msg : message});
		} else {
			socket.emit("chat-error", "Cannot find " + to);
		}		
	}
}

function sendOnlineClients(socket){
	var users = [];
	var keys = Object.keys(clients);
	for(var i=0; i<keys.length; i++){
		users.push(clients[keys[i]].name);
	}
	console.log(users);
	socket.emit("online-clients", users);
}

var socket;
var username;
var currentRoom;

var listRoomsConstruct = /^[\/](rooms){1}/;
var createRoomConstruct = /^[\/]create\s.{3,}/;
var joinRoomConstruct = /^[\/]join\s.{3,}/;
var leaveRoomConstruct = /^[\/]leave/;
var deleteRoomConstruct = /^[\/]delete\s.{3,}/;
var onlineConstruct = /^[\/]online/;

function zeroPad(num, size) {
  var s = num + "";
  while (s.length < size)
    s = "0" + s;
  return s;
}

function timeFormat(msTime) {
  var d = new Date(msTime);
  return zeroPad(d.getHours(), 2) + ":" +
    zeroPad(d.getMinutes(), 2) + ":" +
    zeroPad(d.getSeconds(), 2) + " ";
}

function listRooms(){
	socket.emit("list-rooms");
}

function createRoom(roomName){
	if(currentRoom !== null){
		if(currentRoom === roomName){
			$("#messages").append("<li><span> Already a member.</span></li>");			
		} else {
			$("#messages").append("<li><span> Leave current room and try again.</span></li>");
		}
	} else {
		socket.emit("create-room", roomName);
	}
}

function joinRoom(roomName){
	if(currentRoom !== null){
		if(currentRoom === roomName){
			$("#messages").append("<li><span> Already a member.</span></li>");			
		} else {
			$("#messages").append("<li><span> At a time you can be in a single room. Leave current room and try again.</span></li>");
		}
	} else {
		currentRoom = roomName;
		socket.emit("join-room", roomName);
	}
}

function leaveRoom(){
	if( currentRoom !== null ){
		socket.emit("leave-room", currentRoom);
	} else {
		$("#messages").append("<li><span> To leave a room you should be member of one.</span></li>");
	}
}

function deleteRoom(roomName){
	if( currentRoom === null || currentRoom !== roomName){
		$("#messages").append("<li><span>To delete you should be its current member and admin.</span></li>");	
	} else {
		socket.emit("delete-room", roomName);
	}
}

function login(){
	username = $("#username").val();
	if(username.length > 2){
			socket.emit("login", username);
	} else {
		$("#loginMessage").empty();
		$("#loginMessage").append("username should be of atleast 3 characters");
		$("#loginMessage").show();
		$("#username").focus();
	}
}

function online(){
	socket.emit("online");
}

function sendProcedure(){
	var message = $("#message").val();
    message = $.trim(message);

    if (message.match(listRoomsConstruct)) {
      listRooms();
    } else if (message.match(createRoomConstruct)) { 
      createRoom(message.split(' ')[1]);
    } else if (message.match(joinRoomConstruct)) {
      joinRoom(message.split(' ')[1]);
    } else if (message.match(leaveRoomConstruct)) {
      leaveRoom();
    } else if (message.match(deleteRoomConstruct)) {
      deleteRoom(message.split(' ')[1]);
    } else if (message.match(onlineConstruct)) {
      online();
    } else {
    	var t = /^[@].*\s.*/;
    	if(currentRoom !== null || message.match(t)) {
    		socket.emit("send", currentRoom, new Date().getTime(), message);      
    	} else {
    		$("#messages").append("<li><span> Please join a room to send message.</span></li>");
    	}
    }

    $("#message").val("");
    $("#message").focus();
}

$(document).ready(function() {

	socket = io.connect("https://chatarpatar.herokuapp.com/");

	$("form").submit(function(event) {
		event.preventDefault();
  	});

  	$("#loginMessage").hide();
  	$("#chat").hide();
  	$("#username").focus();

  	$('#username').on('keydown', function(e){
  		$("#loginMessage").hide();
		var key = e.which || e.keyCode;
		if(key == 13) {
			login();
		}
	});

	$('#loginForm').submit(function(){
		//login();
	});

	$('#message').on('keydown', function(e){
  		var key = e.which || e.keyCode;
		if(key == 13) {
			sendProcedure();
		}
	});

	$('#messageForm').submit(function(){
		//sendProcedure();
	});





	socket.on("error-login", function(){
		$("#loginMessage").empty();
	  	$("#loginMessage").append("username " + username + " already in use.");
	  	$("#loginMessage").show();
	  	$("#username").val("");
	  	$("#username").focus();
	});

	socket.on("success-login", function(data){
		currentRoom = username;
		$("#login").hide();
		$("#chat").show();
		$("#message").focus();
	});

	socket.on("update", function(message){
		$.notify(message, "info");
	});

	socket.on("room-list", function(data){
     	if (data.data.length>0){
	     	for(var i=0; i<data.data.length; i++){
	     		$('#messages').append("<li>" + data.data[i] + "</li>");	
	     	}
    	} else {
      		$("#messages").append("<li class=\"list-group-item\">There are no rooms yet.</li>");
    	}
	});

	socket.on("message", function(data){
		$("#messages").append("<li><span> " + timeFormat(data.on) + " " + data.from + ": " + data.msg +"</span></li>");
	});

	socket.on("chat-error", function(msg){
		$("#messages").append("<li><span> "+ msg +" </span></li>");
	});

	socket.on("room-left", function(){
		$("#messages").append("<li><span> You left "+ currentRoom +". </span></li>");
		currentRoom = null;
	});

	socket.on("room-left-admin", function(){
		$("#messages").append("<li><span> You(admin) left "+ currentRoom +". All members were forced to leave.</span></li>");
		currentRoom = null;
	});

	socket.on("force-leave-room", function(){
		$("#messages").append("<li><span> "+ currentRoom +" 's admin deleted/left the room. Being a menber you have to leave too.</span></li>");
		currentRoom = null;
	});

	socket.on("disconnect", function(){
	    $("#messages").append("<li><strong><span class='text-warning'>The server is not available</span></strong></li>");
	    $("#message").attr("disabled", "disabled");
	    $("#send").attr("disabled", "disabled");
  	});

  	socket.on("error-join", function(){
  		currentRoom = null;
  		$("#messages").append("<li><span> No such room exists. </span></li>");
  	});

  	socket.on("success-join", function(){
  		$("#messages").append("<li><span> Welcome to " + currentRoom + "</span></li>");
  	});

  	socket.on("error-create", function(){
  		$("#messages").append("<li><span> Room already exists.</span></li>");
  	});

  	socket.on("success-create", function(msg){
  		currentRoom = msg;
   	});

   	socket.on("private-message", function(data){
		$("#messages").append("<li><span> " + timeFormat(data.on) + " (private) " + data.from + ": " + data.msg +"</span></li>");
	});

	socket.on("success-private", function(data){
		$("#messages").append("<li><span> " + timeFormat(data.on) + " (private) You ->" + data.too + ": " + data.msg +"</span></li>");
	});

	socket.on("online-clients", function(data){
     	if (data.length>0){
	     	for(var i=0; i<data.length; i++){
	     		$('#messages').append("<li>" + data[i] + "</li>");	
	     	}
    	} else {
      		$("#messages").append("<li class=\"list-group-item\">There are no rooms yet.</li>");
    	}
	});

});
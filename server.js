// server.js
// Simple Express + Socket.io server for DrawUsTogether
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST']
  }
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Lobby: Track active rooms, canvas data, and chat
let rooms = {};
let canvasData = {}; // Store drawing data for each room
let chatMessages = {}; // Store chat messages for each room
let roomCreators = {}; // Track who created each room

function broadcastRooms() {
  io.emit('roomList', Object.keys(rooms));
}

io.on('connection', (socket) => {
  console.log('A user connected');

  // Send current room list to new user
  socket.emit('roomList', Object.keys(rooms));

  socket.on('createRoom', (room) => {
    if (!rooms[room]) {
      rooms[room] = { users: 0 };
      canvasData[room] = []; // Initialize empty canvas for new room
      chatMessages[room] = []; // Initialize empty chat for new room
      roomCreators[room] = socket.id; // Track room creator
      broadcastRooms();
    }
  });

  socket.on('getRooms', () => {
    socket.emit('roomList', Object.keys(rooms));
  });

  socket.on('joinRoom', (room) => {
    socket.join(room);
    if (!rooms[room]) {
      rooms[room] = { users: 0 };
      canvasData[room] = [];
      chatMessages[room] = [];
      roomCreators[room] = socket.id; // First joiner becomes creator
    }
    rooms[room].users++;
    broadcastRooms();
    
    // Send existing canvas data to the new user
    if (canvasData[room] && canvasData[room].length > 0) {
      socket.emit('loadCanvas', canvasData[room]);
    }
    
    // Send existing chat messages to the new user
    if (chatMessages[room] && chatMessages[room].length > 0) {
      socket.emit('loadChat', chatMessages[room]);
    }
    
    // Tell user if they are the room creator
    socket.emit('roomCreator', socket.id === roomCreators[room]);
    
    console.log(`User joined room: ${room}`);
  });

  socket.on('drawing', ({ room, data }) => {
    // Store the drawing data for persistence
    if (!canvasData[room]) canvasData[room] = [];
    canvasData[room].push(data);
    
    // Limit stored data to prevent memory issues (keep last 1000 strokes)
    if (canvasData[room].length > 1000) {
      canvasData[room] = canvasData[room].slice(-1000);
    }
    
    socket.to(room).emit('drawing', data);
  });

  socket.on('chatMessage', ({ room, message, username }) => {
    const chatMsg = {
      id: Date.now() + Math.random(),
      message,
      username,
      time: new Date().toLocaleTimeString()
    };
    
    if (!chatMessages[room]) chatMessages[room] = [];
    chatMessages[room].push(chatMsg);
    
    // Limit chat messages to last 50
    if (chatMessages[room].length > 50) {
      chatMessages[room] = chatMessages[room].slice(-50);
    }
    
    io.to(room).emit('chatMessage', chatMsg);
  });

  socket.on('clearCanvas', (room) => {
    // Only allow room creator to clear canvas
    if (roomCreators[room] === socket.id) {
      canvasData[room] = [];
      io.to(room).emit('clearCanvas');
    }
  });

  socket.on('leaveRoom', (room) => {
    socket.leave(room);
    if (rooms[room]) {
      rooms[room].users = Math.max(0, rooms[room].users - 1);
      if (rooms[room].users === 0) {
        delete rooms[room];
        delete canvasData[room];
        delete chatMessages[room];
        delete roomCreators[room];
      }
      broadcastRooms();
    }
  });

  socket.on('disconnecting', () => {
    // Remove user from all rooms
    for (const room of socket.rooms) {
      if (room !== socket.id && rooms[room]) {
        rooms[room].users = Math.max(0, rooms[room].users - 1);
        if (rooms[room].users === 0) {
          delete rooms[room];
          delete canvasData[room];
          delete chatMessages[room];
          delete roomCreators[room];
        }
      }
    }
    broadcastRooms();
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 
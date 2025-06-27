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

// Lobby: Track active rooms and canvas data
let rooms = {};
let canvasData = {}; // Store drawing data for each room

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
    }
    rooms[room].users++;
    broadcastRooms();
    
    // Send existing canvas data to the new user
    if (canvasData[room] && canvasData[room].length > 0) {
      socket.emit('loadCanvas', canvasData[room]);
    }
    
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

  socket.on('clearCanvas', (room) => {
    canvasData[room] = [];
    socket.to(room).emit('clearCanvas');
  });

  socket.on('leaveRoom', (room) => {
    socket.leave(room);
    if (rooms[room]) {
      rooms[room].users = Math.max(0, rooms[room].users - 1);
      if (rooms[room].users === 0) {
        delete rooms[room];
        delete canvasData[room]; // Clean up canvas data when room is empty
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
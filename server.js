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

// Lobby: Track active rooms, canvas data, chat, and clear votes
let rooms = {};
let canvasData = {}; // Store drawing data for each room
let chatMessages = {}; // Store chat messages for each room
let clearVotes = {}; // Track clear canvas votes: {room: {userId: 'yes'|'no'}}

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
      clearVotes[room] = {}; // Initialize empty votes for new room
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
      clearVotes[room] = {};
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

  socket.on('requestClearCanvas', (room) => {
    // Reset votes for this room
    clearVotes[room] = {};
    io.to(room).emit('clearCanvasVote', { 
      message: 'Someone wants to clear the canvas. Vote:',
      votes: { yes: 0, no: 0 }
    });
  });

  socket.on('voteClearCanvas', ({ room, vote, userId }) => {
    if (!clearVotes[room]) clearVotes[room] = {};
    clearVotes[room][userId] = vote;
    
    const yesCount = Object.values(clearVotes[room]).filter(v => v === 'yes').length;
    const noCount = Object.values(clearVotes[room]).filter(v => v === 'no').length;
    const totalUsers = rooms[room] ? rooms[room].users : 0;
    
    io.to(room).emit('clearCanvasVote', {
      message: `Clear canvas vote: ${yesCount} yes, ${noCount} no`,
      votes: { yes: yesCount, no: noCount, total: totalUsers }
    });
    
    // If majority votes yes, clear the canvas
    if (yesCount > noCount && yesCount + noCount >= Math.ceil(totalUsers / 2)) {
      canvasData[room] = [];
      clearVotes[room] = {};
      io.to(room).emit('clearCanvas');
      io.to(room).emit('clearCanvasVote', {
        message: 'Canvas cleared by majority vote!',
        votes: { yes: 0, no: 0, total: 0 }
      });
    }
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
        delete canvasData[room];
        delete chatMessages[room];
        delete clearVotes[room];
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
          delete clearVotes[room];
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
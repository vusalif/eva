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
    methods: ['GET', 'POST'],
    credentials: true
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

  socket.on('joinRoom', (room, username) => {
    socket.username = username; // Store username in socket object
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
    
    // Send system message to all users in the room
    const systemMsg = {
      id: Date.now() + Math.random(),
      message: `${socket.username || 'A user'} joined the room.`,
      username: 'System',
      time: new Date().toLocaleTimeString(),
      type: 'system'
    };
    
    console.log('Sending join system message:', systemMsg);
    
    if (!chatMessages[room]) chatMessages[room] = [];
    chatMessages[room].push(systemMsg);
    
    // Limit chat messages to last 50
    if (chatMessages[room].length > 50) {
      chatMessages[room] = chatMessages[room].slice(-50);
    }
    
    io.to(room).emit('chatMessage', systemMsg);
    
    console.log(`User joined room: ${room}`);
  });

  socket.on('drawing', ({ room, data }) => {
    console.log(`Drawing in room ${room}:`, data);
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
    console.log(`Chat message in room ${room} from ${username}:`, message);
    const chatMsg = {
      id: Date.now() + Math.random(),
      message,
      username,
      time: new Date().toLocaleTimeString(),
      type: 'user'
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
    // Allow any user to clear canvas
    canvasData[room] = [];
    io.to(room).emit('clearCanvas');
    
    // Send system message about canvas clear
    const systemMsg = {
      id: Date.now() + Math.random(),
      message: `${socket.username || 'A user'} cleared the canvas.`,
      username: 'System',
      time: new Date().toLocaleTimeString(),
      type: 'system'
    };
    
    if (!chatMessages[room]) chatMessages[room] = [];
    chatMessages[room].push(systemMsg);
    
    // Limit chat messages to last 50
    if (chatMessages[room].length > 50) {
      chatMessages[room] = chatMessages[room].slice(-50);
    }
    
    io.to(room).emit('chatMessage', systemMsg);
  });

  socket.on('requestClearCanvas', (room) => {
    // Send clear canvas request message
    const requestMsg = {
      id: Date.now() + Math.random(),
      message: `${socket.username || 'A user'} wants to clear the whole canvas.`,
      username: 'System',
      time: new Date().toLocaleTimeString(),
      type: 'clear-request'
    };
    
    if (!chatMessages[room]) chatMessages[room] = [];
    chatMessages[room].push(requestMsg);
    
    // Limit chat messages to last 50
    if (chatMessages[room].length > 50) {
      chatMessages[room] = chatMessages[room].slice(-50);
    }
    
    io.to(room).emit('chatMessage', requestMsg);
  });

  socket.on('leaveRoom', (room) => {
    // Send system message before leaving
    const systemMsg = {
      id: Date.now() + Math.random(),
      message: `${socket.username || 'A user'} left the room.`,
      username: 'System',
      time: new Date().toLocaleTimeString(),
      type: 'system'
    };
    
    console.log('Sending leave system message:', systemMsg);
    
    if (chatMessages[room]) {
      chatMessages[room].push(systemMsg);
      
      // Limit chat messages to last 50
      if (chatMessages[room].length > 50) {
        chatMessages[room] = chatMessages[room].slice(-50);
      }
      
      io.to(room).emit('chatMessage', systemMsg);
    }
    
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
    // Remove user from all rooms and send system messages
    for (const room of socket.rooms) {
      if (room !== socket.id && rooms[room]) {
        // Send system message for disconnection
        const systemMsg = {
          id: Date.now() + Math.random(),
          message: `${socket.username || 'A user'} disconnected.`,
          username: 'System',
          time: new Date().toLocaleTimeString(),
          type: 'system'
        };
        
        if (chatMessages[room]) {
          chatMessages[room].push(systemMsg);
          
          // Limit chat messages to last 50
          if (chatMessages[room].length > 50) {
            chatMessages[room] = chatMessages[room].slice(-50);
          }
          
          socket.to(room).emit('chatMessage', systemMsg);
        }
        
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
}); 
// script.js for DrawUsTogether
// Handles drawing, controls, room join, and real-time sync

const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const penSize = document.getElementById('penSize');
const saveBtn = document.getElementById('saveBtn');

let drawing = false;
let current = {
  color: colorPicker.value,
  size: penSize.value,
  opacity: document.getElementById('opacity').value,
  brushType: document.getElementById('brushType').value
};
let room = '';

// Socket.io setup
const socket = io("https://eva-kreb.onrender.com");

// Drawing helpers
function drawLine(x0, y0, x1, y1, color, size, opacity, brushType, emit) {
  ctx.globalAlpha = opacity / 100;
  
  if (brushType === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
  }
  
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  
  if (brushType === 'marker') {
    ctx.lineJoin = 'round';
  } else if (brushType === 'spray') {
    // Spray effect - draw multiple small circles
    const steps = Math.max(1, Math.floor(Math.sqrt((x1-x0)**2 + (y1-y0)**2) / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      ctx.beginPath();
      ctx.arc(x, y, size / 3, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return;
  }
  
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.closePath();
  
  // Reset global settings
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  if (!emit) return;
  const w = canvas.width;
  const h = canvas.height;
  socket.emit('drawing', {
    room,
    data: {
      x0: x0 / w,
      y0: y0 / h,
      x1: x1 / w,
      y1: y1 / h,
      color,
      size,
      opacity,
      brushType
    }
  });
}

// Mouse events
let last = { x: 0, y: 0 };
canvas.addEventListener('mousedown', (e) => {
  if (!room) return alert('Join a room first!');
  drawing = true;
  last = getPos(e);
});
canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const pos = getPos(e);
  drawLine(last.x, last.y, pos.x, pos.y, current.color, current.size, current.opacity, current.brushType, true);
  last = pos;
});
canvas.addEventListener('mouseup', () => { drawing = false; });
canvas.addEventListener('mouseleave', () => { drawing = false; });

// Touch events for mobile
canvas.addEventListener('touchstart', (e) => {
  if (!room) return alert('Join a room first!');
  drawing = true;
  last = getTouchPos(e);
});
canvas.addEventListener('touchmove', (e) => {
  if (!drawing) return;
  const pos = getTouchPos(e);
  drawLine(last.x, last.y, pos.x, pos.y, current.color, current.size, current.opacity, current.brushType, true);
  last = pos;
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', () => { drawing = false; });

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}
function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  return {
    x: t.clientX - rect.left,
    y: t.clientY - rect.top
  };
}

// Color and pen size controls
colorPicker.addEventListener('input', (e) => {
  current.color = e.target.value;
});
penSize.addEventListener('input', (e) => {
  current.size = e.target.value;
});

// Save drawing as image
saveBtn.addEventListener('click', () => {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drawing.png';
  a.click();
});

// Receive drawing data from others
socket.on('drawing', (data) => {
  const w = canvas.width;
  const h = canvas.height;
  drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size, data.opacity, data.brushType, false);
});

// Prevent scrolling on touch devices when drawing
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });

// Lobby and room logic
const lobby = document.getElementById('lobby');
const drawArea = document.getElementById('drawArea');
const roomList = document.getElementById('roomList');
const newRoomInput = document.getElementById('newRoomInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const leaveBtn = document.getElementById('leaveBtn');
const currentRoomSpan = document.getElementById('currentRoom');

// Remove all showLobby/hide logic, sidebar is always visible
function showDrawArea(roomName) {
  currentRoomSpan.textContent = roomName ? 'Room: ' + roomName : '';
}

// Render room list
function renderRoomList(rooms) {
  roomList.innerHTML = '';
  if (rooms.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No rooms yet. Create one!';
    roomList.appendChild(li);
    return;
  }
  rooms.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'Join';
    joinBtn.className = 'join-room-btn';
    joinBtn.onclick = () => joinRoom(r);
    li.appendChild(joinBtn);
    roomList.appendChild(li);
  });
}

// Socket.io lobby events
socket.on('roomList', renderRoomList);

function joinRoom(roomName) {
  room = roomName;
  socket.emit('joinRoom', room);
  showDrawArea(room);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function leaveRoom() {
  if (room) {
    socket.emit('leaveRoom', room);
    room = '';
    showDrawArea('');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

createRoomBtn.addEventListener('click', () => {
  const val = newRoomInput.value.trim();
  if (!val) return alert('Enter a room name!');
  socket.emit('createRoom', val);
  joinRoom(val);
  newRoomInput.value = '';
});

leaveBtn.addEventListener('click', leaveRoom);

// On load, just clear current room
showDrawArea('');
socket.emit('getRooms');

socket.on('createRoom', (room) => {
  if (!rooms[room]) {
    rooms[room] = { users: 0 };
    broadcastRooms();
  }
});

// Canvas persistence
socket.on('loadCanvas', (drawingData) => {
  // Clear current canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Redraw all stored strokes
  drawingData.forEach(stroke => {
    const w = canvas.width;
    const h = canvas.height;
    drawLine(
      stroke.x0 * w, stroke.y0 * h, 
      stroke.x1 * w, stroke.y1 * h, 
      stroke.color, stroke.size, stroke.opacity, stroke.brushType, false
    );
  });
});

socket.on('clearCanvas', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Add clear canvas button
const clearBtn = document.createElement('button');
clearBtn.textContent = 'Clear Canvas';
clearBtn.style.background = '#ffc107';
clearBtn.style.color = '#000';
clearBtn.style.border = 'none';
clearBtn.style.borderRadius = '4px';
clearBtn.style.padding = '0.5rem 1rem';
clearBtn.style.cursor = 'pointer';
clearBtn.style.marginRight = '1rem';

// Chat and voting elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

// Generate unique user ID and username
const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
const username = 'Player_' + Math.floor(Math.random() * 1000);

// Chat functionality
function addChatMessage(msg) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  messageDiv.innerHTML = `
    <span class="username">${msg.username}</span>
    <span class="time">${msg.time}</span>
    <div>${msg.message}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
  const message = chatInput.value.trim();
  if (message && room) {
    socket.emit('chatMessage', { room, message, username });
    chatInput.value = '';
  }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Load chat messages
socket.on('loadChat', (messages) => {
  chatMessages.innerHTML = '';
  messages.forEach(addChatMessage);
});

// Receive chat messages
socket.on('chatMessage', addChatMessage);

// Room creator detection
let isRoomCreator = false;
socket.on('roomCreator', (isCreator) => {
  isRoomCreator = isCreator;
  clearBtn.style.display = isCreator ? 'block' : 'none';
});

// Clear canvas (only for room creator)
clearBtn.onclick = () => {
  if (room && isRoomCreator) {
    socket.emit('clearCanvas', room);
  }
};

// Update size and opacity display
penSize.addEventListener('input', (e) => {
  current.size = e.target.value;
  sizeValue.textContent = e.target.value;
});

opacity.addEventListener('input', (e) => {
  current.opacity = e.target.value;
  opacityValue.textContent = e.target.value + '%';
});

// Brush type and color controls
brushType.addEventListener('input', (e) => {
  current.brushType = e.target.value;
});

colorPicker.addEventListener('input', (e) => {
  current.color = e.target.value;
});

// Update drawing data emission
function drawLine(x0, y0, x1, y1, color, size, opacity, brushType, emit) {
  // ... existing drawing logic ...
  
  if (!emit) return;
  const w = canvas.width;
  const h = canvas.height;
  socket.emit('drawing', {
    room,
    data: {
      x0: x0 / w,
      y0: y0 / h,
      x1: x1 / w,
      y1: y1 / h,
      color,
      size,
      opacity,
      brushType
    }
  });
}

// Remove voting system code
// ... existing code ... 
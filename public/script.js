// script.js for DrawUsTogether - Minimal UI version
// Handles drawing, controls, room join, and real-time sync

document.addEventListener('DOMContentLoaded', function () {
  // DOM elements
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  const colorPicker = document.getElementById('colorPicker');
  const penSize = document.getElementById('penSize');
  const opacityInput = document.getElementById('opacity');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const imageInput = document.getElementById('imageInput');
  const roomList = document.getElementById('roomList');
  const newRoomInput = document.getElementById('newRoomInput');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const roomsDropdownToggle = document.getElementById('roomsDropdownToggle');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  // State
  let drawing = false;
  let current = {
    color: colorPicker.value,
    size: penSize.value,
    opacity: opacityInput.value
  };
  let room = '';
  let roomsDropdownOpen = true;
  let chatHistory = {};
  let canvasHistory = {};

  // Socket.io setup
  const socket = io("https://eva-kreb.onrender.com");

  // Drawing helpers
  function drawLine(x0, y0, x1, y1, color, size, opacity, emit) {
    ctx.globalAlpha = opacity / 100;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();
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
        opacity
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
    drawLine(last.x, last.y, pos.x, pos.y, current.color, current.size, current.opacity, true);
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
    drawLine(last.x, last.y, pos.x, pos.y, current.color, current.size, current.opacity, true);
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
  opacityInput.addEventListener('input', (e) => {
    current.opacity = e.target.value;
  });

  // Save drawing as image
  saveBtn.addEventListener('click', () => {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawing.png';
    a.click();
  });

  // Image upload and drawing
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new window.Image();
    img.onload = function() {
      // Fit image to canvas (max 90% of canvas size)
      const maxW = canvas.width * 0.9;
      const maxH = canvas.height * 0.9;
      let w = img.width;
      let h = img.height;
      if (w > maxW) {
        h = h * (maxW / w);
        w = maxW;
      }
      if (h > maxH) {
        w = w * (maxH / h);
        h = maxH;
      }
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      // Optionally, emit to others (if you want real-time image sync)
      // You could send the image as dataURL, but that's not implemented here for simplicity
    };
    img.src = URL.createObjectURL(file);
    imageInput.value = '';
  });

  // Dropdown for available rooms
  roomsDropdownToggle.addEventListener('click', () => {
    roomsDropdownOpen = !roomsDropdownOpen;
    if (roomsDropdownOpen) {
      roomList.classList.remove('closed');
      roomsDropdownToggle.classList.remove('open');
    } else {
      roomList.classList.add('closed');
      roomsDropdownToggle.classList.add('open');
    }
  });
  // Start open
  roomList.classList.remove('closed');
  roomsDropdownToggle.classList.remove('open');

  // Room-specific chat
  function renderChatMessages() {
    chatMessages.innerHTML = '';
    const msgs = chatHistory[room] || [];
    msgs.forEach(addChatMessage);
  }

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

  // Load chat messages for a room
  socket.on('loadChat', (messages) => {
    chatHistory[room] = messages;
    renderChatMessages();
  });

  // Receive chat messages for the current room
  socket.on('chatMessage', (msg) => {
    if (!chatHistory[room]) chatHistory[room] = [];
    chatHistory[room].push(msg);
    renderChatMessages();
  });

  // Lobby and room logic
  function renderRoomList(rooms) {
    roomList.innerHTML = '';
    if (rooms.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No rooms yet.';
      roomList.appendChild(li);
      return;
    }
    rooms.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      const dot = document.createElement('span');
      dot.className = 'room-dot';
      li.appendChild(dot);
      li.onclick = () => joinRoom(r);
      roomList.appendChild(li);
    });
  }

  socket.on('roomList', renderRoomList);

  function joinRoom(roomName) {
    room = roomName;
    socket.emit('joinRoom', room);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderChatMessages();
    // Request chat and canvas for this room
    socket.emit('getChat', room);
    socket.emit('getCanvas', room);
  }

  createRoomBtn.addEventListener('click', () => {
    const val = newRoomInput.value.trim();
    if (!val) return alert('Enter a room name!');
    socket.emit('createRoom', val);
    joinRoom(val);
    newRoomInput.value = '';
  });

  // On load, just clear current room and get rooms
  socket.emit('getRooms');

  // Canvas persistence per room
  socket.on('loadCanvas', (drawingData) => {
    canvasHistory[room] = drawingData;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingData.forEach(stroke => {
      const w = canvas.width;
      const h = canvas.height;
      drawLine(
        stroke.x0 * w, stroke.y0 * h, 
        stroke.x1 * w, stroke.y1 * h, 
        stroke.color, stroke.size, stroke.opacity, false
      );
    });
  });

  socket.on('drawing', (data) => {
    const w = canvas.width;
    const h = canvas.height;
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size, data.opacity, false);
  });

  socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Clear canvas button
  clearBtn.onclick = () => {
    if (room) {
      socket.emit('clearCanvas', room);
    }
  };

  // Generate unique user ID and username
  const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const username = 'Player_' + Math.floor(Math.random() * 1000);
}); 
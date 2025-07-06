// script.js for DrawUsTogether - Minimal UI version
// Handles drawing, controls, room join, and real-time sync

document.addEventListener('DOMContentLoaded', function () {
  // DOM elements
  const usernameModal = document.getElementById('usernameModal');
  const usernameInput = document.getElementById('usernameInput');
  const confirmUsernameBtn = document.getElementById('confirmUsernameBtn');
  
  const lobbyScreen = document.getElementById('lobbyScreen');
  const gameRoomScreen = document.getElementById('gameRoomScreen');
  const roomList = document.getElementById('roomList');
  const newRoomInput = document.getElementById('newRoomInput');
  const createRoomBtn = document.getElementById('createRoomBtn');

  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  const colorPicker = document.getElementById('colorPicker');
  const penSize = document.getElementById('penSize');
  const opacityInput = document.getElementById('opacity');
  const brushSettingsPanel = document.getElementById('brushSettingsPanel');
  const toggleBrushBtn = document.getElementById('toggleBrushBtn');
  const closeBrushPanelBtn = document.getElementById('closeBrushPanelBtn');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const chatPanel = document.getElementById('chatPanel');
  const toggleChatBtn = document.getElementById('toggleChatBtn');
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
  let strokes = [];
  let redoStack = [];
  let currentStroke = null;
  
  // Generate unique user ID and default username
  const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  let username = 'Player_' + Math.floor(Math.random() * 1000);
  let usernameSet = false;

  // Socket.io setup
  const socket = io();
  
  // Debug connection
  socket.on('connect', () => {
    console.log('Connected to server');
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  // Username prompt functionality
  function showUsernamePrompt() {
    usernameModal.style.display = 'flex';
    usernameInput.focus();
    usernameInput.value = username.replace('Player_', '');
  }

  function hideUsernamePrompt() {
    usernameModal.style.display = 'none';
    usernameSet = true;
  }

  function setUsername() {
    const newUsername = usernameInput.value.trim();
    if (newUsername) {
      username = newUsername;
      hideUsernamePrompt();
      // Now proceed with joining the room
      proceedWithRoomJoin();
    } else {
      alert('Please enter a valid username!');
      usernameInput.focus();
    }
  }

  confirmUsernameBtn.addEventListener('click', setUsername);
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setUsername();
    }
  });

  // Store pending room join action
  let pendingRoomJoin = null;

  function proceedWithRoomJoin() {
    if (pendingRoomJoin) {
      const roomName = pendingRoomJoin;
      pendingRoomJoin = null;
      joinRoom(roomName);
    }
  }

  // Lobby logic
  function renderRoomList(rooms) {
    roomList.innerHTML = '';
    if (!rooms.length) {
      const li = document.createElement('li');
      li.textContent = 'No rooms yet.';
      roomList.appendChild(li);
      return;
    }
    rooms.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      li.onclick = () => {
        if (!usernameSet) {
          pendingRoomJoin = r;
          showUsernamePrompt();
        } else {
          joinRoom(r);
        }
      };
      roomList.appendChild(li);
    });
  }
  socket.on('roomList', renderRoomList);

  createRoomBtn.addEventListener('click', () => {
    const val = newRoomInput.value.trim();
    if (!val) return alert('Enter a room name!');
    
    if (!usernameSet) {
      pendingRoomJoin = val;
      showUsernamePrompt();
    } else {
      socket.emit('createRoom', val);
      joinRoom(val);
    }
    newRoomInput.value = '';
  });

  // Join room: hide lobby, show game room
  function joinRoom(roomName) {
    room = roomName;
    socket.emit('joinRoom', room);
    lobbyScreen.style.display = 'none';
    gameRoomScreen.style.display = 'flex';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    chatMessages.innerHTML = '';
    strokes = [];
    redoStack = [];
    currentStroke = null;
  }

  // Leave room: show lobby, clear state
  leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', room);
    room = '';
    gameRoomScreen.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    chatMessages.innerHTML = '';
    strokes = [];
    redoStack = [];
    currentStroke = null;
    socket.emit('getRooms');
  });

  // On load, show lobby and get rooms
  lobbyScreen.style.display = 'flex';
  gameRoomScreen.style.display = 'none';
  usernameModal.style.display = 'none';
  socket.emit('getRooms');

  // Brush settings toggle and close
  toggleBrushBtn.addEventListener('click', () => {
    brushSettingsPanel.classList.toggle('active');
  });
  closeBrushPanelBtn.addEventListener('click', () => {
    brushSettingsPanel.classList.remove('active');
  });

  // Make brush settings panel draggable
  let dragOffsetX = 0, dragOffsetY = 0, dragging = false;
  brushSettingsPanel.addEventListener('mousedown', function(e) {
    if (e.target === closeBrushPanelBtn) return;
    dragging = true;
    dragOffsetX = e.clientX - brushSettingsPanel.getBoundingClientRect().left;
    dragOffsetY = e.clientY - brushSettingsPanel.getBoundingClientRect().top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    brushSettingsPanel.style.left = (e.clientX - dragOffsetX) + 'px';
    brushSettingsPanel.style.top = (e.clientY - dragOffsetY) + 'px';
    brushSettingsPanel.style.transform = '';
  });
  document.addEventListener('mouseup', function() {
    dragging = false;
    document.body.style.userSelect = '';
  });

  // Chat panel toggle
  toggleChatBtn.addEventListener('click', () => {
    chatPanel.classList.toggle('hide');
  });

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
    const drawingData = {
      room: room,
      data: {
        x0: x0 / w,
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color,
        size,
        opacity
      }
    };
    console.log('Sending drawing data:', drawingData);
    socket.emit('drawing', drawingData);
  }

  // Redraw all strokes
  function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      for (let i = 1; i < stroke.points.length; i++) {
        const p0 = stroke.points[i - 1];
        const p1 = stroke.points[i];
        drawLine(p0.x, p0.y, p1.x, p1.y, stroke.color, stroke.size, stroke.opacity, false);
      }
    }
  }

  // Mouse events
  let last = { x: 0, y: 0 };
  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    last = getPos(e);
    currentStroke = {
      color: current.color,
      size: current.size,
      opacity: current.opacity,
      points: [last]
    };
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    drawLine(last.x, last.y, pos.x, pos.y, current.color, current.size, current.opacity, true);
    if (currentStroke) currentStroke.points.push(pos);
    last = pos;
  });
  canvas.addEventListener('mouseup', () => {
    if (drawing && currentStroke && currentStroke.points.length > 1) {
      strokes.push(currentStroke);
      redoStack = [];
    }
    drawing = false;
    currentStroke = null;
  });
  canvas.addEventListener('mouseleave', () => {
    if (drawing && currentStroke && currentStroke.points.length > 1) {
      strokes.push(currentStroke);
      redoStack = [];
    }
    drawing = false;
    currentStroke = null;
  });

  // Touch events for mobile
  canvas.addEventListener('touchstart', (e) => {
    drawing = true;
    last = getTouchPos(e);
    currentStroke = {
      color: current.color,
      size: current.size,
      opacity: current.opacity,
      points: [last]
    };
  });
  canvas.addEventListener('touchmove', (e) => {
    if (!drawing) return;
    const pos = getTouchPos(e);
    drawLine(last.x, last.y, pos.x, pos.y, current.color, current.size, current.opacity, true);
    if (currentStroke) currentStroke.points.push(pos);
    last = pos;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    if (drawing && currentStroke && currentStroke.points.length > 1) {
      strokes.push(currentStroke);
      redoStack = [];
    }
    drawing = false;
    currentStroke = null;
  });

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

  // Brush controls
  colorPicker.addEventListener('input', (e) => {
    current.color = e.target.value;
  });
  penSize.addEventListener('input', (e) => {
    current.size = e.target.value;
  });
  opacityInput.addEventListener('input', (e) => {
    current.opacity = e.target.value;
  });

  // Undo/Redo logic
  undoBtn.addEventListener('click', () => {
    if (strokes.length > 0) {
      redoStack.push(strokes.pop());
      redrawAll();
    }
  });
  redoBtn.addEventListener('click', () => {
    if (redoStack.length > 0) {
      strokes.push(redoStack.pop());
      redrawAll();
    }
  });

  // Download canvas
  downloadBtn.addEventListener('click', () => {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawing.png';
    a.click();
  });

  // Clear canvas
  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    redoStack = [];
    currentStroke = null;
    socket.emit('clearCanvas', room);
  });

  // Receive drawing data from others
  socket.on('drawing', (data) => {
    console.log('Received drawing data:', data);
    // For collaborative: treat each remote stroke as a single-segment stroke
    const w = canvas.width;
    const h = canvas.height;
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size, data.opacity, false);
    // Optionally, add to strokes for undo/redo (if you want collaborative undo/redo)
  });

  // Receive clear canvas event
  socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    redoStack = [];
    currentStroke = null;
  });

  // Load existing canvas data when joining room
  socket.on('loadCanvas', (canvasData) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    canvasData.forEach(data => {
      drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size, data.opacity, false);
    });
  });

  // Chat logic
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
    if (message) {
      const chatData = { room: room, message, username };
      console.log('Sending chat message:', chatData);
      socket.emit('chatMessage', chatData);
      chatInput.value = '';
      autoResizeChatInput();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    autoResizeChatInput();
  });
  chatInput.addEventListener('input', autoResizeChatInput);

  function autoResizeChatInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
  }

  // Receive chat messages
  socket.on('chatMessage', (msg) => {
    console.log('Received chat message:', msg);
    addChatMessage(msg);
  });

  // Load existing chat messages when joining room
  socket.on('loadChat', (messages) => {
    chatMessages.innerHTML = '';
    messages.forEach(msg => addChatMessage(msg));
  });
}); 
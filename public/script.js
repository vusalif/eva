// script.js for DrawUsTogether
// Handles drawing, controls, room join, and real-time sync

const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const penSize = document.getElementById('penSize');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const saveBtn = document.getElementById('saveBtn');

let drawing = false;
let current = {
  color: colorPicker.value,
  size: penSize.value
};
let room = '';

// Socket.io setup
const socket = io();

// Drawing helpers
function drawLine(x0, y0, x1, y1, color, size, emit) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.closePath();

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
      size
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
  drawLine(last.x, last.y, pos.x, pos.y, current.color, current.size, true);
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
  drawLine(last.x, last.y, pos.x, pos.y, current.color, current.size, true);
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

// Room join logic
joinBtn.addEventListener('click', () => {
  const val = roomInput.value.trim();
  if (!val) return alert('Enter a room name!');
  room = val;
  socket.emit('joinRoom', room);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  alert('Joined room: ' + room);
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
  drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size, false);
});

// Prevent scrolling on touch devices when drawing
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false }); 
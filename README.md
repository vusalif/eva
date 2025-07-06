# DrawUsTogether - Real-Time Collaborative Drawing App

A real-time collaborative drawing application where multiple users can draw together on the same canvas and chat in real-time.

## Features

- **Real-time collaborative drawing**: Draw together with others in the same room
- **Real-time chat**: Send messages to other users in the room
- **Room-based collaboration**: Join different rooms for different drawing sessions
- **Brush settings**: Adjust color, size, and opacity
- **Undo/Redo**: Local undo/redo functionality
- **Download drawings**: Save your collaborative artwork
- **Mobile responsive**: Works on desktop and mobile devices
- **Persistent canvas**: Drawing persists when users join/leave

## How to Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open in browser**:
   - Go to `http://localhost:3000`
   - Open multiple browser tabs/windows to test collaboration

## How to Test Real-Time Collaboration

1. **Start the server** and open `http://localhost:3000` in your browser
2. **Create a room** by entering a room name and clicking "Create/Join"
3. **Open another browser tab/window** and go to `http://localhost:3000`
4. **Join the same room** by clicking on it in the room list
5. **Start drawing** in one tab - you should see the drawing appear in the other tab in real-time
6. **Send chat messages** - they should appear in both tabs instantly

## Testing from Different Computers

To test from different computers on the same network:

1. **Find your computer's IP address**:
   - Windows: Run `ipconfig` in Command Prompt
   - Mac/Linux: Run `ifconfig` in Terminal

2. **Update the server** to listen on all interfaces:
   ```javascript
   // In server.js, change the last line to:
   server.listen(PORT, '0.0.0.0', () => {
     console.log(`Server running on http://0.0.0.0:${PORT}`);
   });
   ```

3. **Access from other computers** using `http://YOUR_IP_ADDRESS:3000`

## Troubleshooting

- **Check browser console** (F12) for any error messages
- **Check server console** for connection logs
- **Make sure firewall allows port 3000** if testing from different computers
- **Clear browser cache** if you see old versions

## Technical Details

- **Frontend**: HTML5 Canvas, JavaScript, Socket.io client
- **Backend**: Node.js, Express, Socket.io
- **Real-time communication**: WebSocket via Socket.io
- **Canvas persistence**: Drawing data stored in memory per room
- **Chat persistence**: Messages stored in memory per room

## Room Management

- Rooms are created when the first user joins
- Rooms are automatically deleted when all users leave
- Each room has its own canvas and chat history
- Drawing and chat data persists while users are in the room 
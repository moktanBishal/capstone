const http = require('http');
const path = require('path');
const send = require('send');
const WebSocket = require('ws');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/capstone', {
  connectTimeoutMS: 30000,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define schema for chat rooms
const roomSchema = new mongoose.Schema({
  name: String,
});

const Room = mongoose.model('Room', roomSchema);

// Define schema for chat messages
const messageSchema = new mongoose.Schema({
  roomName: String,
  nickname: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

// Create HTTP server
const server = http.createServer((req, res) => {
  const requestedFilePath = req.url === '/' ? path.join(__dirname, 'chat.html') : path.join(__dirname, req.url);
  send(req, requestedFilePath)
    .on('error', (err) => {
      console.error(err);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    })
    .pipe(res);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Maintain a map to store connected clients and their nicknames
const connectedClients = new Map();

// Maintain a map to store chat rooms and their messages
const chatRoomMessages = new Map();

// Maintain a map to store the room each client is connected to
const clientRooms = new Map();

// When the server starts, retrieve existing chat rooms from MongoDB and store them in the chatRoomMessages map
async function initializeChatRooms() {
  try {
    const existingRooms = await Room.find();
    existingRooms.forEach(room => {
      chatRoomMessages.set(room.name, []);
    });
  } catch (err) {
    console.error('Error retrieving chat rooms from database:', err);
  }
}

// Call the function to initialize chat rooms when the server starts
initializeChatRooms();

// Function to handle request for existing rooms
async function handleGetRoomsRequest(ws) {
  try {
    const existingRooms = await Room.find({}, 'name');
    const roomNames = existingRooms.map(room => room.name);
    ws.send(JSON.stringify({ type: 'roomList', rooms: roomNames }));
  } catch (error) {
    console.error('Error retrieving rooms:', error);
  }
}

// Function to send chat history when a client joins a room
async function sendChatHistory(ws, roomName) {
  try {
    // Retrieve messages from the database for the specified room
    const messages = await Message.find({ roomName: roomName }).sort({ timestamp: 'asc' });
    
    // Send the chat history to the client
    ws.send(JSON.stringify({ type: 'chatHistory', messages }));
  } catch (error) {
    console.error('Error retrieving chat history:', error);
  }
}

// Handle WebSocket connection
wss.on('connection', async ws => {
  // Prompt the client to set a nickname
  ws.send(JSON.stringify({ type: 'setNicknamePrompt', message: 'Please set your nickname to join the chat.' }));

  ws.on('message', async message => {
    const data = JSON.parse(message);

    // Handle setting nickname
    if (data.type === 'setNickname') {
      const nickname = data.nickname;
      if ([...connectedClients.values()].includes(nickname)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Nickname is already taken. Please choose a different one.' }));
        return;
      }
      connectedClients.set(ws, nickname);
      ws.send(JSON.stringify({ type: 'systemMessage', message: `You have set your nickname as ${nickname}.` }));
      return;
    }

    // Handle room creation
    if (data.type === 'createRoom') {
      const newRoomName = data.roomName;
      if (chatRoomMessages.has(newRoomName)) {
        ws.send(JSON.stringify({ type: 'systemMessage', message: `Room "${newRoomName}" already exists.` }));
        return;
      }
      const newRoom = new Room({ name: newRoomName });
      try {
        await newRoom.save();
        chatRoomMessages.set(newRoomName, []);
        ws.send(JSON.stringify({ type: 'systemMessage', message: `New room "${newRoomName}" created.` }));
        clientRooms.set(ws, newRoomName);
        broadcastSystemMessage(`${connectedClients.get(ws)} has created the room "${newRoomName}".`);
      } catch (error) {
        console.error('Error creating chat room:', error);
      }
      return;
    }

    // Handle room joining
    if (data.type === 'joinRoom') {
      const roomName = data.roomName;
      if (!chatRoomMessages.has(roomName)) {
        ws.send(JSON.stringify({ type: 'systemMessage', message: `Room "${roomName}" does not exist.` }));
        return;
      }
      clientRooms.set(ws, roomName);
      ws.send(JSON.stringify({ type: 'systemMessage', message: `You have joined room "${roomName}".` }));
      // Send chat history for the room
      await sendChatHistory(ws, roomName);
      broadcastSystemMessage(`${connectedClients.get(ws)} has joined the room "${roomName}".`, roomName);
      return;
    }

    // Handle chat messages
    if (data.type === 'chatMessage') {
      const roomName = clientRooms.get(ws);
      if (!roomName) {
        ws.send(JSON.stringify({ type: 'error', message: 'You are not connected to a room.' }));
        return;
      }
      const message = {
        nickname: connectedClients.get(ws),
        text: data.text,
        roomName,
      };

      // Store the message in the database
      const newMessage = new Message(message);
      await newMessage.save();

      // Broadcast the message to the room
      broadcastChatMessage(roomName, message);
    }
  });

  ws.on('close', () => {
    const nickname = connectedClients.get(ws);
    if (nickname) {
      const roomName = clientRooms.get(ws);
      broadcastSystemMessage(`${nickname} has left the chat.`, roomName);
      connectedClients.delete(ws);
      clientRooms.delete(ws);
    }
  });
});

// Function to broadcast system messages
function broadcastSystemMessage(message, roomName = null) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      if (roomName) {
        const roomUsers = clientRooms.get(client);
        if (roomUsers === roomName) {
          client.send(JSON.stringify({ type: 'systemMessage', message }));
        }
      } else {
        client.send(JSON.stringify({ type: 'systemMessage', message }));
      }
    }
  });
}

// Function to broadcast chat messages to a specific room
function broadcastChatMessage(roomName, message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && clientRooms.get(client) === roomName) {
      client.send(JSON.stringify({ type: 'chatMessage', ...message }));
    }
  });
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/`);
});

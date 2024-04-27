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
const roomSchema = new mongoose.Schema({name: String});
const Room = mongoose.model('Room', roomSchema);

// Define schema for chat messages
const messageSchema = new mongoose.Schema({
  roomName: String,
  nickname: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);
// Export the models and any necessary database functions
module.exports = { Room, Message };

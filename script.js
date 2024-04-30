// Establish a WebSocket connection to the server
const ws = new WebSocket('ws://192.168.1.64:3000');

// Function to send a JSON message to the server
function sendJsonMessage(type, data) {
  ws.send(JSON.stringify({ type, ...data }));
}

// Function to scroll the chat div to the bottom
function scrollToBottom() {
  const chat = document.getElementById('chat');
  chat.scrollTop = chat.scrollHeight;
}

// Event handler for receiving messages from the server
ws.onmessage = function(event) {
  const data = JSON.parse(event.data);

  if (data.type === 'roomList') {
    // Handle the list of existing rooms
    const select = document.getElementById('roomList');
    select.innerHTML = '';
    data.rooms.forEach(room => {
      const option = document.createElement('option');
      option.value = room;
      option.textContent = room;
      select.appendChild(option);
    });
  } else if (data.type === 'systemMessage') {
    // Handle system messages
    appendMessage(data.message, 'system-message');
  } else if (data.type === 'chatMessage') {
    // Handle chat messages
    const message = `${data.message.nickname}: ${data.message.text}`;
    appendMessage(message);
    scrollToBottom(); // Scroll to bottom when new message is added
  } else if (data.type === 'existingMessages') {
    // Handle existing chat messages
    const chat = document.getElementById('chat');
    chat.innerHTML = '';
    data.messages.forEach(msg => {
      const message = `${msg.nickname}: ${msg.text}`;
      appendMessage(message);
    });
    scrollToBottom(); // Scroll to bottom when existing messages are loaded
  }
};

// Function to append a message to the chat
function appendMessage(message, className = 'message') {
  const chat = document.getElementById('chat');
  const messageDiv = document.createElement('div');
  messageDiv.classList.add(className);
  messageDiv.innerHTML = `<span class="chat-content">${message}</span>`;
  chat.appendChild(messageDiv);
}

// Event handler for the "Set Nickname" button
document.getElementById('setNicknameButton').addEventListener('click', () => {
  const nicknameInput = document.getElementById('nicknameInput');
  const nickname = nicknameInput.value.trim();

  if (nickname !== '') {
    sendJsonMessage('setNickname', { nickname });
    nicknameInput.value = ''; // Clear input field after setting nickname
  }
});

// Event handler for the "Create Room" button
document.getElementById('createRoomButton').addEventListener('click', () => {
  const roomNameInput = document.getElementById('roomNameInput');
  const roomName = roomNameInput.value.trim();

  if (roomName !== '') {
    sendJsonMessage('createRoom', { roomName });
    roomNameInput.value = ''; // Clear input field after creating room
  }
});

// Event handler for the "Join Room" button
document.getElementById('joinRoomButton').addEventListener('click', () => {
  const roomName = document.getElementById('roomList').value.trim();

  if (roomName !== '') {
    sendJsonMessage('joinRoom', { roomName });
  }
});

// Event handler for the "Get Rooms" button
document.getElementById('getRoomsButton').addEventListener('click', () => {
  sendJsonMessage('getRooms', {});
});

// Event handler for the "Send Message" button
document.getElementById('sendMessageButton').addEventListener('click', () => {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();
  const roomName = document.getElementById('roomList').value.trim();
  if (message !== '') {
    sendJsonMessage('chatMessage', { message, roomName });
    messageInput.value = ''; // Clear input field after sending message
  }
});

// test-socket-client.js
const io = require("socket.io-client");

// Connect to your backend socket server
const socket = io("http://localhost:8002");

// Listen for the 'newNotification' event from the server
socket.on("newNotification", (data) => {
  console.log("New notification received:", data.message);
  // Simulate UI update or logging
});

// Listen for the socket connection event to verify that the socket is connected
socket.on("connect", () => {
  console.log("Connected to server with socketId:", socket.id);
});

// Handle any potential connection errors
socket.on("connect_error", (err) => {
  console.log("Error connecting:", err);
});

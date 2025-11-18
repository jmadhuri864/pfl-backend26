// import io  from "socket.io-client";

// // Connect to your Socket.IO server
// const socket = io("http://localhost:8002", {
//   reconnection: true, // Automatically reconnect if the connection drops
//   reconnectionAttempts: 5, // Retry up to 5 times
//   timeout: 5000, // 5 seconds timeout
// });

// // Event when connected
// socket.on("connect", () => {
//   console.log(" Connected to Socket.IO server:", socket.id);

//   // Join a specific room (example: userId = '12345')
//   socket.emit("joinRoom", "0b6cd544-b2fd-4d81-a9ac-52ea49d31747");
//   console.log("Joined room: 0b6cd544-b2fd-4d81-a9ac-52ea49d31747");

 
//   socket.emit("sendNotification", {
//     userId: "0b6cd544-b2fd-4d81-a9ac-52ea49d31747",
//     message: "Hello from backend client!",
//   });
// });


// socket.on("newNotification", (data:any) => {
//   console.log("🔔 Received Notification:", data);
// });


// socket.on("connect_error", (err:any) => {
//   console.error("❌ Connection Error:", err.message);
// });


// socket.on("disconnect", () => {
//   console.log("⚠️ Disconnected from server");
// });

// export default socket;

import { Server } from "socket.io";

export default function initSocket(server) {

  //& Color codes for console output

  const green = '\x1b[32m';    // Green
  // const cyan = '\x1b[36m';     // Cyan
  // const yellow = '\x1b[33m';   // Yellow
  const magenta = '\x1b[35m';  // Magenta
  // const skyblue = '\x1b[94m';  // Sky Blue
  const red = '\x1b[31m';      // Red
  const reset = '\x1b[0m';     // Reset


  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    }
  });

  io.on("connection", (socket) => {
    console.log(`${green}User Connected through Socket.io: ${magenta}${socket.id}${reset}`);

    socket.on("join_room", (userId) => {
      socket.join(userId);
      console.log(`${green}User ${magenta}${userId} ${green}joined their personal room${reset}`);
    });

    socket.on("send_message", (data, callback) => {
      io.to(data.receiverId).emit("receive_message", data);

      //& send notification to the receiver
      io.to(data.receiverId).emit("new_notification", {
        chatRoomId: data.chatRoomId,
        from: data.senderId,
        message: data.message,
        messageType: data.messageType || 'text',
        timestamp: new Date()
      });

      callback({ status: "sent" });
    });

    //& Seen update
    socket.on("mark_seen", ({ roomId, userId }) => {
      io.to(userId).emit("seen_update", { roomId, userId });
    });

    socket.on("disconnect", () => {
      console.log(`${red}User Disconnected from Socket.io: ${magenta}${socket.id}${reset}`);
    });
  });
}

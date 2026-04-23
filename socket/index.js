const { Server } = require("socket.io");

let io;

function initSocket(server) {
    io = new Server(server, {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:5174"],
            methods: ["GET", "POST"],
            credentials: true
        },
        transports: ['websocket', 'polling']
    });

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        socket.on("joinRoom", (data) => {

            socket.join(data.userId);
            socket.emit("roomJoined", data.userId);
        });



        socket.on("disconnect", (reason) => {
            console.log("User disconnected:", socket.id, "Reason:", reason);
        });

        socket.on("error", (error) => {
            console.error("Socket error:", error);
        });
    });

    return io;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
}

module.exports = { initSocket, getIO };
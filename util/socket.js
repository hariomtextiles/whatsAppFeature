let io;
const onlineUsers = new Map();

const initSocket = (server) => {
    const { Server } = require("socket.io");

    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {

        socket.on("user-login", (userId) => {
            if (!userId) return;

            userId = String(userId);

            let user = onlineUsers.get(userId);

            if (!user) {
                user = {
                    userId,
                    loginTime: new Date(),
                    lastSeen: null,
                    status: "online",
                    socketIds: new Set()
                };
            }

            user.socketIds.add(socket.id);
            user.status = "online";
            user.lastSeen = null;

            onlineUsers.set(userId, user);

            socket.userId = userId;

            emitOnlineUsers();
            console.log("User online:", userId);
        });

        socket.on("user-logout", (userId) => {
            if (!userId) return;

            userId = String(userId);

            const user = onlineUsers.get(userId);

            if (user) {
                user.lastSeen = new Date();
                user.status = "offline";
                user.socketIds.forEach(socketId => {
                    io.sockets.sockets.get(socketId)?.disconnect(true);
                });
                user.socketIds.clear();

                onlineUsers.set(userId, user);
            }

            emitOnlineUsers();
            console.log("User logged out:", userId);
        });

        socket.on("disconnect", () => {
            if (socket.userId) {
                const user = onlineUsers.get(socket.userId);

                if (user) {
                    user.socketIds.delete(socket.id);

                    if (user.socketIds.size === 0) {
                        user.lastSeen = new Date();
                        user.status = "offline";
                    }

                    onlineUsers.set(socket.userId, user);
                }

                emitOnlineUsers();
                console.log("User disconnected:", socket.userId);
            }
        });
    });

    return io;
};

const getIO = () => io;

const getOnlineUsers = () => Array.from(onlineUsers.values()).map(user => ({
    userId: user.userId,
    loginTime: user.loginTime,
    lastSeen: user.lastSeen,
    status: user.status,
    activeTabs: user.socketIds.size
}));

const emitOnlineUsers = () => {
    io.emit("online-users", getOnlineUsers());
};

module.exports = { initSocket, getIO, getOnlineUsers };
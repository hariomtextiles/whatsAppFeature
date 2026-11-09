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

        socket.on("user-login", ({ userId, deviceId }) => {
            if (!userId || !deviceId) return;

            userId = String(userId);
            deviceId = String(deviceId);

            let user = onlineUsers.get(userId);

            if (!user) {
                user = {
                    userId,
                    loginTime: new Date(),
                    lastSeen: null,
                    status: "online",
                    devices: new Map()
                };
            }

            if (user.status === "offline") {
                user.loginTime = new Date();
            }

            let device = user.devices.get(deviceId);

            if (!device) {
                device = {
                    deviceId,
                    socketIds: new Set()
                };
            }

            device.socketIds.add(socket.id);

            user.devices.set(deviceId, device);
            user.status = "online";
            user.lastSeen = null;

            onlineUsers.set(userId, user);

            socket.userId = userId;
            socket.deviceId = deviceId;

            emitOnlineUsers();
            console.log("User online:", userId, "Device:", deviceId);
        });

        socket.on("user-logout", () => {
            const userId = socket.userId;
            const deviceId = socket.deviceId;

            if (!userId || !deviceId) return;

            const user = onlineUsers.get(userId);

            if (!user) return;

            const device = user.devices.get(deviceId);

            if (device) {
                const socketIds = Array.from(device.socketIds);

                user.devices.delete(deviceId);

                socketIds.forEach(socketId => {
                    io.sockets.sockets.get(socketId)?.disconnect(true);
                });
            }

            if (user.devices.size === 0) {
                user.lastSeen = new Date();
                user.status = "offline";
            }

            onlineUsers.set(userId, user);

            emitOnlineUsers();
            console.log("Device logged out:", userId, deviceId);
        });

        socket.on("disconnect", () => {
            const userId = socket.userId;
            const deviceId = socket.deviceId;

            if (!userId || !deviceId) return;

            const user = onlineUsers.get(userId);

            if (user) {
                const device = user.devices.get(deviceId);

                if (device) {
                    device.socketIds.delete(socket.id);

                    if (device.socketIds.size === 0) {
                        user.devices.delete(deviceId);
                    }
                }

                if (user.devices.size === 0) {
                    user.lastSeen = new Date();
                    user.status = "offline";
                }

                onlineUsers.set(userId, user);
            }

            emitOnlineUsers();
            console.log("User disconnected:", userId, "Device:", deviceId);
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
    activeTabs: Array.from(user.devices.values()).reduce((total, device) => total + device.socketIds.size, 0),
    devices: Array.from(user.devices.values()).map(device => ({
        deviceId: device.deviceId,
        activeTabs: device.socketIds.size
    }))
}));

const emitOnlineUsers = () => {
    io.emit("online-users", getOnlineUsers());
};

module.exports = { initSocket, getIO, getOnlineUsers };

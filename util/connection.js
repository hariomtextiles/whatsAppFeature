const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys");

const P = require("pino");
const QRCode = require("qrcode");
const fs = require("fs-extra");

const AUTH_FOLDER = "auth";

global.whatsapp = global.whatsapp || {
    sock: null,
    connected: false,
    connecting: false,
    number: null,
    qr: null,
    pairingCode: null,
    status: "idle"
};

async function connectWhatsapp(pairingNumber = null) {

    if (global.whatsapp.sock) {

        try {
            global.whatsapp.sock.end();
        } catch (e) {}

        global.whatsapp.sock = null;
        global.whatsapp.connected = false;
        global.whatsapp.connecting = false;
        global.whatsapp.number = null;
        global.whatsapp.status = "idle";

    }

    global.whatsapp.connecting = true;
    global.whatsapp.connected = false;
    global.whatsapp.status = "connecting";

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: false
    });

    global.whatsapp.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    return new Promise((resolve, reject) => {

        let finished = false;

        const finish = (result) => {

            if (finished) return;

            finished = true;

            resolve(result);

        };

        sock.ev.on("connection.update", async (update) => {

            const { connection, qr, lastDisconnect } = update;

            console.log(" Connection update = ", update);

            if (qr && !pairingNumber) {

                const image = await QRCode.toDataURL(qr);

                global.whatsapp.status = "waiting";

                return finish({ type: "qr", qr: image });

            }

            if (connection === "open") {

                global.whatsapp.connected = true;
                global.whatsapp.connecting = false;
                global.whatsapp.status = "connected";

                const jid = sock.user?.id || state.creds?.me?.id;

                if (jid) {
                    global.whatsapp.number = jid.split(":")[0].split("@")[0];
                }

                await saveCreds();

                return;

            }

            if (connection === "close") {

                global.whatsapp.connected = false;
                global.whatsapp.connecting = false;

                const statusCode = lastDisconnect?.error?.output?.statusCode;

                console.log("Close ", statusCode);

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {

                    await fs.remove(AUTH_FOLDER).catch(() => {});

                    global.whatsapp.sock = null;
                    global.whatsapp.number = null;
                    global.whatsapp.status = "loggedOut";

                    return;
                }


                //if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
                if (
                    statusCode === DisconnectReason.restartRequired ||
                    statusCode === 515 ||
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === 428 ||
                    (
                        (statusCode === DisconnectReason.connectionLost || statusCode === 408) &&
                        !message.includes("QR refs attempts ended")
                    )
                ){

                    console.log("Reconnecting...",statusCode," Reason",DisconnectReason);

                    global.whatsapp.sock = null;

                    setTimeout(() => { connectWhatsapp(); }, 1000);

                    return;
                }


                // Other temporary disconnects
                console.log("Temp disconnect");
                global.whatsapp.sock = null;
                global.whatsapp.status = "disconnected";

                return;


                // if (!finished) {
                //     reject(new Error("Connection closed."));
                // }

            }

        });

        if (pairingNumber) {

            setTimeout(async () => {

                try {

                    const code = await sock.requestPairingCode(pairingNumber);

                    global.whatsapp.status = "waiting";

                    finish({
                        type: "pairing",
                        pairingCode: code
                    });

                } catch (err) {

                    reject(err);

                }

            }, 3000);

        }

    });

}

async function checkWhatsappConnection() {

    if (global.whatsapp.sock && global.whatsapp.connected) {
        return {
            connected: true,
            number: global.whatsapp.number
        };
    }

    if (!(await fs.pathExists(AUTH_FOLDER)) || (await fs.readdir(AUTH_FOLDER)).length === 0)  {

        return {
            connected: false
        };

    }

    return new Promise(async (resolve) => {

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

        const sock = makeWASocket({
            auth: state,
            logger: P({ level: "silent" }),
            printQRInTerminal: false,
            syncFullHistory: false
        });

        let finished = false;

        const finish = async (result) => {

            if (finished) return;

            finished = true;

            try {
                sock.end();
            } catch (e) {}

            resolve(result);

        };

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {

            const {
                connection,
                lastDisconnect
            } = update;

            if (connection === "open") {

                const jid = sock.user?.id || state.creds?.me?.id;

                let number = null;

                if (jid) {
                    number = jid.split(":")[0].split("@")[0];
                }

                return finish({
                    connected: true,
                    number
                });

            }

            if (connection === "close") {

                const statusCode = lastDisconnect?.error?.output?.statusCode;

                if (
                    statusCode === DisconnectReason.loggedOut ||
                    statusCode === 401
                ) {

                    try {
                        await fs.remove(AUTH_FOLDER);
                    } catch (e) {}

                }

                return finish({
                    connected: false
                });

            }

        });

        setTimeout(() => {

            finish({
                connected: false
            });

        }, 30000);

    });

}

function getWhatsappStatus() {

    return {
        connected: global.whatsapp.connected,
        connecting: global.whatsapp.connecting,
        status: global.whatsapp.status,
        number: global.whatsapp.number,
        pairingCode: global.whatsapp.pairingCode
    };

}

function getWhatsappQR() {

    return {
        qr: global.whatsapp.qr
    };

}

module.exports = {
    connectWhatsapp,
    checkWhatsappConnection,
    getWhatsappStatus,
    getWhatsappQR
};
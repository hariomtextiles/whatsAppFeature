// whatsapp/messaging.js

const fs = require("fs-extra");
const path = require("path");
const { checkWhatsappConnection } = require("./connection");

async function getSocket() {

    if (
        global.whatsapp &&
        global.whatsapp.connected &&
        global.whatsapp.sock
    ) {
        return global.whatsapp.sock;
    }

    const result = await checkWhatsappConnection();

    if (!result.connected) {
        throw new Error("WhatsApp is not connected.");
    }

    return result.sock;
}

async function checkWhatsappNumber(number) {

    const sock = await getSocket();

    const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";

    const result = await sock.onWhatsApp(jid);

    return result && result.length > 0;
}

async function sendWhatsappMessage(number, message) {

    const sock = await getSocket();

    const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";

    await sock.sendMessage(jid, {
        text: message
    });

    return true;
}

async function sendWhatsappInvoice(number, message, pdfPath) {

    if (!(await fs.pathExists(pdfPath))) {
        throw new Error("Invoice PDF not found.");
    }

    const sock = await getSocket();

    const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";

    await sock.sendMessage(jid, {
        document: await fs.readFile(pdfPath),
        mimetype: "application/pdf",
        fileName: path.basename(pdfPath),
        caption: message
    });

    return true;
}

module.exports = {
    checkWhatsappNumber,
    sendWhatsappMessage,
    sendWhatsappInvoice
};
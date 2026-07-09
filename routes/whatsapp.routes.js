const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");

const {
    connectWhatsapp,
    checkWhatsappConnection,
    getWhatsappStatus
} = require("../util/connection");

const {
    checkWhatsappNumber,
    sendWhatsappMessage,
    sendWhatsappInvoice
} = require("../util/messaging");

const router = express.Router();

const upload = multer({
    dest: "uploads/"
});

router.post("/pair", async (req, res) => {

    try {

        const { phoneNumber } = req.body;

        const result = await connectWhatsapp(phoneNumber);

        res.json({
            success: true,
            pairingCode: result.pairingCode
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

router.post("/qr", async (req, res) => {

    try {

        const result = await connectWhatsapp();

        res.json({
            success: true,
            qr: result.qr
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

router.get("/status", (req, res) => {

    try {

        res.json({
            success: true,
            ...getWhatsappStatus()
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

router.get("/connection", async (req, res) => {

    try {

        const result = await checkWhatsappConnection();

        res.json({
            success: true,
            connected: result.connected,
            number: result?.number
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

router.post("/check-number", async (req, res) => {

    try {

        const { number } = req.body;

        const exists = await checkWhatsappNumber(number);

        res.json({
            success: true,
            exists
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

router.post("/send-message", async (req, res) => {

    try {

        const { number, message } = req.body;

        await sendWhatsappMessage(number, message);

        res.json({
            success: true
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

router.post("/send-invoice", upload.single("invoice"), async (req, res) => {

    try {

        const { number, message } = req.body;

        await sendWhatsappInvoice(
            number,
            message,
            req.file.path
        );

        await fs.remove(req.file.path);

        res.json({
            success: true
        });

    } catch (err) {

        if (req.file) {
            await fs.remove(req.file.path).catch(() => {});
        }

        res.json({
            success: false,
            message: err.message
        });

    }

});

module.exports = router;
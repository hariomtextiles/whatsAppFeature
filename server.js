require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");

const { initSocket } = require("./util/socket");

const whatsappRoutes = require("./routes/whatsapp.routes");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initSocket(server);

app.get("/", (req, res) => { res.json({success: true, message: "WhatsApp API Running"}); });

app.use("/api/whatsapp", whatsappRoutes);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
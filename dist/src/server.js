"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const chat_1 = require("./sockets/chat");
const server = http_1.default.createServer(app_1.default);
(0, chat_1.initChat)(server); // attach Socket.IO
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';
server.listen(PORT, () => console.log(`API listening on :${PORT}`));

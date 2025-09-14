"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChat = initChat;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../db/prisma");
function initChat(httpServer) {
    const io = new socket_io_1.Server(httpServer, { path: '/socket.io', cors: { origin: process.env.CLIENT_URL } });
    const chat = io.of('/chat');
    chat.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.toString().replace('Bearer ', '');
        try {
            const user = jsonwebtoken_1.default.verify(token, process.env.JWT_ACCESS_SECRET);
            socket.user = user;
            return next();
        }
        catch {
            return next(new Error('Unauthorized'));
        }
    });
    chat.on('connection', (socket) => {
        const user = socket.user;
        socket.on('join-conversation', async (conversationId) => {
            const member = await prisma_1.prisma.conversationParticipant.findUnique({
                where: { conversationId_userId: { conversationId, userId: user.id } }
            });
            if (!member)
                return;
            socket.join(conversationId);
        });
        socket.on('send-message', async ({ conversationId, content }) => {
            // optional: encrypt content here before saving
            const msg = await prisma_1.prisma.message.create({
                data: { conversationId, senderId: user.id, content }
            });
            await prisma_1.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
            chat.to(conversationId).emit('new-message', msg);
        });
    });
    return io;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChat = initChat;
// src/sockets/chat.ts
const socket_io_1 = require("socket.io");
const prisma_1 = require("../db/prisma");
const jwt_1 = require("../utils/jwt"); // ✅ reuse REST JWT logic
const zod_1 = require("zod");
function initChat(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        path: '/socket.io',
        cors: {
            origin: process.env.CLIENT_URL?.split(',') ?? '*',
            credentials: true
        }
    });
    const chat = io.of('/chat');
    // 🔐 Auth middleware per connection (runs once per connection)
    chat.use((socket, next) => {
        try {
            const bearer = socket.handshake.auth?.token
                || socket.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, '');
            if (!bearer)
                return next(new Error('Unauthorized'));
            const user = (0, jwt_1.verifyAccess)(bearer); // { id, role, iat, exp }
            socket.data.user = { id: user.id, role: user.role };
            return next();
        }
        catch {
            return next(new Error('Unauthorized'));
        }
    });
    // Zod schemas for events
    const joinSchema = zod_1.z.object({ conversationId: zod_1.z.string().min(1) });
    const sendSchema = zod_1.z.object({ conversationId: zod_1.z.string().min(1), content: zod_1.z.string().min(1).max(4000) });
    // (Optional) very small anti-spam limiter
    const lastSentAt = {}; // socket.id -> ts
    const MIN_GAP_MS = 250; // ~4 msgs/sec
    chat.on('connection', (socket) => {
        const me = socket.data.user;
        socket.on('join-conversation', async (payload) => {
            const { conversationId } = joinSchema.parse({ conversationId: payload?.conversationId ?? payload });
            const member = await prisma_1.prisma.conversationParticipant.findUnique({
                where: { conversationId_userId: { conversationId, userId: me.id } }
            });
            if (!member)
                return; // silently ignore
            socket.join(conversationId); // ✅ room join (emit to this room later)
        });
        socket.on('send-message', async (payload) => {
            // basic rate limit
            const now = Date.now();
            if (lastSentAt[socket.id] && now - lastSentAt[socket.id] < MIN_GAP_MS)
                return;
            lastSentAt[socket.id] = now;
            const { conversationId, content } = sendSchema.parse(payload);
            // authorize membership for this conversation
            const member = await prisma_1.prisma.conversationParticipant.findUnique({
                where: { conversationId_userId: { conversationId, userId: me.id } }
            });
            if (!member)
                return; // ignore if not a member
            const msg = await prisma_1.prisma.message.create({
                data: { conversationId, senderId: me.id, content }
            });
            await prisma_1.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
            // ✅ broadcast only to the room (both parties)
            chat.to(conversationId).emit('new-message', msg);
            // Optional: also emit a conversation bump for lists
            chat.to(conversationId).emit('conversation-updated', { id: conversationId, lastMessageAt: new Date().toISOString() });
        });
    });
    return io;
}

// src/sockets/chat.ts
import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { prisma } from '../db/prisma';
import { verifyAccess } from '../utils/jwt'; // ✅ reuse REST JWT logic
import { z } from 'zod';

export function initChat(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
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

      if (!bearer) return next(new Error('Unauthorized'));
      const user = verifyAccess(bearer); // { id, role, iat, exp }

      socket.data.user = { id: user.id, role: user.role };
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  // Zod schemas for events
  const joinSchema = z.object({ conversationId: z.string().min(1) });
  const sendSchema = z.object({ conversationId: z.string().min(1), content: z.string().min(1).max(4000) });

  // (Optional) very small anti-spam limiter
  const lastSentAt: Record<string, number> = {}; // socket.id -> ts
  const MIN_GAP_MS = 250; // ~4 msgs/sec

  chat.on('connection', (socket) => {
    const me = socket.data.user as { id: string; role: string };

    socket.on('join-conversation', async (payload: any) => {
      const { conversationId } = joinSchema.parse({ conversationId: payload?.conversationId ?? payload });
      const member = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: me.id } }
      });
      if (!member) return; // silently ignore
      socket.join(conversationId); // ✅ room join (emit to this room later)
    });

    socket.on('send-message', async (payload: any) => {
      // basic rate limit
      const now = Date.now();
      if (lastSentAt[socket.id] && now - lastSentAt[socket.id] < MIN_GAP_MS) return;
      lastSentAt[socket.id] = now;

      const { conversationId, content } = sendSchema.parse(payload);

      // authorize membership for this conversation
      const member = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: me.id } }
      });
      if (!member) return; // ignore if not a member

      const msg = await prisma.message.create({
        data: { conversationId, senderId: me.id, content }
      });
      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });

      // ✅ broadcast only to the room (both parties)
      chat.to(conversationId).emit('new-message', msg);
      // Optional: also emit a conversation bump for lists
      chat.to(conversationId).emit('conversation-updated', { id: conversationId, lastMessageAt: new Date().toISOString() });
    });
  });

  return io;
}

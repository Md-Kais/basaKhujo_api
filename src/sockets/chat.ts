import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { Server as HTTPServer } from 'http';
import { prisma } from '../db/prisma';

export function initChat(httpServer: HTTPServer) {
  const io = new Server(httpServer, { path: '/socket.io', cors: { origin: process.env.CLIENT_URL } });
  const chat = io.of('/chat');

  chat.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.toString().replace('Bearer ', '');
    try {
      const user = jwt.verify(token, process.env.JWT_ACCESS_SECRET!);
      (socket as any).user = user;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  chat.on('connection', (socket) => {
    const user = (socket as any).user;

    socket.on('join-conversation', async (conversationId: string) => {
      const member = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: (user as any).id } }
      });
      if (!member) return;
      socket.join(conversationId);
    });

    socket.on('send-message', async ({ conversationId, content }) => {
      // optional: encrypt content here before saving
      const msg = await prisma.message.create({
        data: { conversationId, senderId: (user as any).id, content }
      });
      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
      chat.to(conversationId).emit('new-message', msg);
    });
  });

  return io;
}

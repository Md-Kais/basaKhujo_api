import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middlewares/auth';
import { z } from 'zod';

const router = Router();

// Schema
const createConversationSchema = z.object({
  userId: z.string().min(1) // the other participant
});

// Utility: find or create a 1:1 conversation
async function getOrCreateOneToOne(userA: string, userB: string) {
  // find existing conversation that has BOTH participants
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: userA } } },
        { participants: { some: { userId: userB } } }
      ]
    },
    include: { participants: true }
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      participants: {
        createMany: { data: [{ userId: userA }, { userId: userB }] }
      }
    },
    include: { participants: true }
  });
}

// POST /api/messages/conversations   -> create or fetch a DM thread
router.post('/conversations', requireAuth, async (req: any, res) => {
  const me = req.user.id as string;
  const { userId } = createConversationSchema.parse(req.body);
  if (me === userId) return res.status(400).json({ message: 'Cannot start a conversation with yourself' });

  // ensure other user exists
  await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true } });

  const convo = await getOrCreateOneToOne(me, userId);
  res.status(201).json(convo);
});

// GET /api/messages/conversations  -> my conversation list
router.get('/conversations', requireAuth, async (req: any, res) => {
  const me = req.user.id as string;
  const items = await prisma.conversation.findMany({
    where: { participants: { some: { userId: me } } },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      participants: {
        where: { NOT: { userId: me } },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } }
      }
    }
  });
  res.json(items);
});

// GET /api/messages/conversations/:id/messages?cursor=&limit=
router.get('/conversations/:id/messages', requireAuth, async (req: any, res) => {
  const me = req.user.id as string;
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const q = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).default(20)
  }).parse(req.query);

  // authorize membership
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: me } }
  });
  if (!membership) return res.status(403).json({ message: 'Forbidden' });

  const args: any = {
    where: { conversationId: id },
    orderBy: { createdAt: 'desc' },
    take: q.limit
  };
  if (q.cursor) {
    args.cursor = { id: q.cursor };
    args.skip = 1; // exclude cursor row itself
  }

  const messages = await prisma.message.findMany(args);
  const nextCursor = messages.length === q.limit ? messages[messages.length - 1].id : null;

  res.json({ items: messages, nextCursor });
});

// POST /api/messages/conversations/:id/messages
router.post('/conversations/:id/messages', requireAuth, async (req: any, res) => {
  const me = req.user.id as string;
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const { content } = z.object({ content: z.string().min(1).max(4000) }).parse(req.body);

  // authorize membership
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: me } }
  });
  if (!membership) return res.status(403).json({ message: 'Forbidden' });

  const msg = await prisma.message.create({
    data: { conversationId: id, senderId: me, content }
  });
  await prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });

  // Realtime delivery is handled in sockets/chat.ts; REST just persists.
  res.status(201).json(msg);
});

export default router;

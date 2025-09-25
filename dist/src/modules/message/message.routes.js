"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/messages/message.router.ts
const express_1 = require("express");
const prisma_1 = require("../../db/prisma");
const auth_1 = require("../../middlewares/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Schemas
const createConversationSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1) // the other participant
});
const startByPropertySchema = zod_1.z.object({
    propertyId: zod_1.z.string().min(1)
});
const idParam = zod_1.z.object({ id: zod_1.z.string().min(1) });
/** Utility: find or create a 1:1 conversation */
async function getOrCreateOneToOne(userA, userB) {
    const existing = await prisma_1.prisma.conversation.findFirst({
        where: {
            AND: [
                { participants: { some: { userId: userA } } },
                { participants: { some: { userId: userB } } }
            ]
        },
        include: { participants: true }
    });
    if (existing)
        return existing;
    return prisma_1.prisma.conversation.create({
        data: {
            participants: {
                createMany: { data: [{ userId: userA }, { userId: userB }] }
            },
            lastMessageAt: new Date()
        },
        include: { participants: true }
    });
}
/** POST /api/messages/conversations -> create/fetch a DM with a userId */
router.post('/conversations', auth_1.requireAuth, async (req, res) => {
    const me = req.user.id;
    const { userId } = createConversationSchema.parse(req.body);
    if (me === userId)
        return res.status(400).json({ message: 'Cannot start a conversation with yourself' });
    await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true } });
    const convo = await getOrCreateOneToOne(me, userId);
    res.status(201).json(convo);
});
/** ✅ POST /api/messages/conversations/by-property -> tenant starts chat with property landlord */
router.post('/conversations/by-property', auth_1.requireAuth, async (req, res) => {
    const me = req.user.id;
    const { propertyId } = startByPropertySchema.parse(req.body);
    const prop = await prisma_1.prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, landlordId: true }
    });
    if (!prop)
        return res.status(404).json({ message: 'Property not found' });
    if (prop.landlordId === me) {
        return res.status(400).json({ message: 'Cannot start conversation with yourself (you are the landlord)' });
    }
    const convo = await getOrCreateOneToOne(me, prop.landlordId);
    res.status(201).json(convo);
});
/** GET /api/messages/conversations -> my conversation list (with counterpart preview) */
router.get('/conversations', auth_1.requireAuth, async (req, res) => {
    const me = req.user.id;
    const items = await prisma_1.prisma.conversation.findMany({
        where: { participants: { some: { userId: me } } },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        include: {
            participants: {
                where: { NOT: { userId: me } },
                include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } }
            },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    });
    res.json(items);
});
/** GET /api/messages/conversations/:id/messages?cursor=&limit= */
router.get('/conversations/:id/messages', auth_1.requireAuth, async (req, res) => {
    const me = req.user.id;
    const { id } = idParam.parse(req.params);
    const q = zod_1.z.object({
        cursor: zod_1.z.string().optional(),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20)
    }).parse(req.query);
    const membership = await prisma_1.prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: id, userId: me } }
    });
    if (!membership)
        return res.status(403).json({ message: 'Forbidden' });
    const args = {
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
        take: q.limit
    };
    if (q.cursor) {
        args.cursor = { id: q.cursor };
        args.skip = 1;
    }
    const messages = await prisma_1.prisma.message.findMany(args);
    const nextCursor = messages.length === q.limit ? messages[messages.length - 1].id : null;
    res.json({ items: messages, nextCursor });
});
/** POST /api/messages/conversations/:id/messages */
router.post('/conversations/:id/messages', auth_1.requireAuth, async (req, res) => {
    const me = req.user.id;
    const { id } = idParam.parse(req.params);
    const { content } = zod_1.z.object({ content: zod_1.z.string().min(1).max(4000) }).parse(req.body);
    const membership = await prisma_1.prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: id, userId: me } }
    });
    if (!membership)
        return res.status(403).json({ message: 'Forbidden' });
    const msg = await prisma_1.prisma.message.create({
        data: { conversationId: id, senderId: me, content }
    });
    await prisma_1.prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
    res.status(201).json(msg);
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../db/prisma");
const auth_1 = require("../../middlewares/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// GET /api/favorites  -> my favorites with property preview
router.get('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.user.id;
    const favs = await prisma_1.prisma.favorite.findMany({
        where: { userId },
        include: {
            property: {
                include: { images: true, landlord: { select: { id: true, name: true } } }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(favs);
});
// POST /api/properties/:id/favorite -> toggle
router.post('/toggle/:propertyId', auth_1.requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { propertyId } = zod_1.z.object({ propertyId: zod_1.z.string().min(1) }).parse(req.params);
    const existing = await prisma_1.prisma.favorite.findUnique({ where: { userId_propertyId: { userId, propertyId } } });
    if (existing) {
        await prisma_1.prisma.favorite.delete({ where: { userId_propertyId: { userId, propertyId } } });
        return res.json({ favorited: false });
    }
    // ensure property exists
    await prisma_1.prisma.property.findUniqueOrThrow({ where: { id: propertyId }, select: { id: true } });
    await prisma_1.prisma.favorite.create({ data: { userId, propertyId } });
    res.json({ favorited: true });
});
exports.default = router;

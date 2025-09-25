"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../db/prisma");
const auth_1 = require("../../middlewares/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
/**
 * GET /api/favorites
 * Returns Favorite rows with property preview (existing)
 */
router.get('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.user.id;
    const favs = await prisma_1.prisma.favorite.findMany({
        where: { userId },
        include: {
            property: {
                include: {
                    images: true,
                    landlord: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json(favs);
});
/**
 * NEW: GET /api/favorites/properties
 * Return only Property objects the current user has favorited.
 * Query: ?page=1&limit=12&orderBy=createdAt|rentMonthly|title&order=asc|desc
 */
const listPropsQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(12),
    orderBy: zod_1.z.enum(['createdAt', 'rentMonthly', 'title']).default('createdAt'),
    order: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
router.get('/properties', auth_1.requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { page, limit, orderBy, order } = listPropsQuery.parse(req.query);
    const where = { favorites: { some: { userId } } }; // relation filter
    const [items, total] = await Promise.all([
        prisma_1.prisma.property.findMany({
            where,
            orderBy: { [orderBy]: order },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                images: true,
                landlord: { select: { id: true, name: true } },
                // include whatever else your UI needs (division/district, etc.)
            },
        }),
        prisma_1.prisma.property.count({ where }),
    ]);
    res.json({ items, total, page, limit, orderBy, order });
});
/**
 * POST /api/favorites/toggle/:propertyId
 * Toggle favorite for the current user (existing, slight polish)
 */
router.post('/toggle/:propertyId', auth_1.requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { propertyId } = zod_1.z.object({ propertyId: zod_1.z.string().min(1) }).parse(req.params);
    const existing = await prisma_1.prisma.favorite.findUnique({
        where: { userId_propertyId: { userId, propertyId } },
    });
    if (existing) {
        await prisma_1.prisma.favorite.delete({ where: { userId_propertyId: { userId, propertyId } } });
        return res.json({ favorited: false });
    }
    await prisma_1.prisma.property.findUniqueOrThrow({ where: { id: propertyId }, select: { id: true } });
    await prisma_1.prisma.favorite.create({ data: { userId, propertyId } });
    res.json({ favorited: true });
});
exports.default = router;

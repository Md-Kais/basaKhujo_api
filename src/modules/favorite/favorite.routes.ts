import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middlewares/auth';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/favorites
 * Returns Favorite rows with property preview (existing)
 */
router.get('/', requireAuth, async (req: any, res) => {
  const userId = req.user.id as string;
  const favs = await prisma.favorite.findMany({
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
const listPropsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  orderBy: z.enum(['createdAt', 'rentMonthly', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

router.get('/properties', requireAuth, async (req: any, res) => {
  const userId = req.user.id as string;
  const { page, limit, orderBy, order } = listPropsQuery.parse(req.query);

  const where = { favorites: { some: { userId } } }; // relation filter
  const [items, total] = await Promise.all([
    prisma.property.findMany({
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
    prisma.property.count({ where }),
  ]);

  res.json({ items, total, page, limit, orderBy, order });
});

/**
 * POST /api/favorites/toggle/:propertyId
 * Toggle favorite for the current user (existing, slight polish)
 */
router.post('/toggle/:propertyId', requireAuth, async (req: any, res) => {
  const userId = req.user.id as string;
  const { propertyId } = z.object({ propertyId: z.string().min(1) }).parse(req.params);

  const existing = await prisma.favorite.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { userId_propertyId: { userId, propertyId } } });
    return res.json({ favorited: false });
  }
  await prisma.property.findUniqueOrThrow({ where: { id: propertyId }, select: { id: true } });
  await prisma.favorite.create({ data: { userId, propertyId } });
  res.json({ favorited: true });
});

export default router;

import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middlewares/auth';
import { z } from 'zod';

const router = Router();

// GET /api/favorites  -> my favorites with property preview
router.get('/', requireAuth, async (req: any, res) => {
  const userId = req.user.id as string;
  const favs = await prisma.favorite.findMany({
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
router.post('/toggle/:propertyId', requireAuth, async (req: any, res) => {
  const userId = req.user.id as string;
  const { propertyId } = z.object({ propertyId: z.string().min(1) }).parse(req.params);

  const existing = await prisma.favorite.findUnique({ where: { userId_propertyId: { userId, propertyId } } });
  if (existing) {
    await prisma.favorite.delete({ where: { userId_propertyId: { userId, propertyId } } });
    return res.json({ favorited: false });
  }
  // ensure property exists
  await prisma.property.findUniqueOrThrow({ where: { id: propertyId }, select: { id: true } });
  await prisma.favorite.create({ data: { userId, propertyId } });
  res.json({ favorited: true });
});

export default router;

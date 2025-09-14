import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { cached, invalidate } from '../../utils/cache';
import { z } from 'zod';

const router = Router();

router.get('/', async (req, res) => {
  const q = z.object({
    divisionId: z.string().optional(),
    districtId: z.string().optional(),
    upazilaId: z.string().optional(),
    rentMin: z.string().optional(),
    rentMax: z.string().optional(),
    beds: z.string().optional(),
    baths: z.string().optional(),
    type: z.string().optional(),
    q: z.string().optional(),
    page: z.string().default('1'),
    limit: z.string().default('12')
  }).parse(req.query);

  const key = `props:${JSON.stringify(q)}`;
  const data = await cached(key, 60, async () => {
    const where: any = {};
    if (q.divisionId) where.divisionId = Number(q.divisionId);
    if (q.districtId) where.districtId = Number(q.districtId);
    if (q.upazilaId) where.upazilaId = Number(q.upazilaId);
    if (q.type) where.type = q.type;
    if (q.beds) where.bedrooms = { gte: Number(q.beds) };
    if (q.baths) where.bathrooms = { gte: Number(q.baths) };
    if (q.rentMin || q.rentMax) where.rentMonthly = { gte: Number(q.rentMin || 0), lte: Number(q.rentMax || 99999999) };
    if (q.q) where.OR = [{ title: { contains: q.q, mode: 'insensitive' }}, { description: { contains: q.q, mode: 'insensitive' }}];

    const page = Number(q.page), limit = Number(q.limit), skip = (page-1)*limit;
    const [items, total] = await Promise.all([
      prisma.property.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { images: true, landlord: { select: { id: true, name: true }}} }),
      prisma.property.count({ where })
    ]);
    return { items, total, page, limit };
  });
  res.json(data);
});

router.post('/', requireAuth, requireRole('LANDLORD','ADMIN'), async (req: any, res) => {
  const body = z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    rentMonthly: z.number(),
    addressLine: z.string(),
    divisionId: z.number(),
    districtId: z.number(),
    upazilaId: z.number(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
    type: z.string().optional(),
    amenities: z.array(z.string()).optional()
  }).parse(req.body);

  const prop = await prisma.property.create({
    data: { ...body, landlordId: req.user.id }
  });
  await invalidate('props:*');
  res.status(201).json(prop);
});

export default router;

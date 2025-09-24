// src/modules/property/property.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { Prisma, PropertyStatus } from '@prisma/client';
// ⬇️ CHANGE this import path if your auth middleware is elsewhere
import { requireAuth, requireRole } from '../../middlewares/auth';

type AuthedReq = Request & { user?: { id: string; role: string } };

const router = Router();

/* -------------------------- Zod Schemas -------------------------- */

const createBody = z.object({
  title: z.string().min(2),
  description: z.string().min(5),
  rentMonthly: z.coerce.number().int().positive(),
  deposit: z.coerce.number().int().nonnegative().optional(),
  type: z.enum(['APARTMENT', 'ROOM', 'HOUSE', 'SUBLET', 'SHOP', 'OFFICE']).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  areaSqft: z.coerce.number().int().min(0).optional(),
  amenities: z.array(z.string()).default([]),
  imageUrls: z.array(z.string().url()).default([]),
  addressLine: z.string().min(2),
  lat: z.coerce.number().optional(),
  lon: z.coerce.number().optional(),
  availableFrom: z.coerce.date().optional(),

  divisionId: z.coerce.number().int().positive(),
  districtId: z.coerce.number().int().positive(),
  upazilaId: z.coerce.number().int().positive(),
});

const updateBody = createBody.partial();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(PropertyStatus).optional(),
  divisionId: z.coerce.number().int().positive().optional(),
  districtId: z.coerce.number().int().positive().optional(),
  upazilaId: z.coerce.number().int().positive().optional(),
  minRent: z.coerce.number().int().nonnegative().optional(),
  maxRent: z.coerce.number().int().nonnegative().optional(),
  q: z.string().trim().optional(),
  sort: z.enum(['new', 'rentAsc', 'rentDesc']).default('new'),
});

/* -------------------------- Utils -------------------------- */

function selectBasic() {
  return {
    id: true,
    title: true,
    description: true,
    rentMonthly: true,
    deposit: true,
    type: true,
    bedrooms: true,
    bathrooms: true,
    areaSqft: true,
    amenities: true,
    imageUrls: true,
    addressLine: true,
    lat: true,
    lon: true,
    status: true,
    availableFrom: true,
    divisionId: true,
    districtId: true,
    upazilaId: true,
    landlordId: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

function mapPrismaError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2003: FK fail, P2025: record not found
    if (err.code === 'P2003') {
      return res.status(409).json({ status: 409, message: 'Foreign key constraint failed (check divisionId/districtId/upazilaId).' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ status: 404, message: 'Property not found.' });
    }
  }
  return next(err);
}

async function ensureOwnerOrAdmin(req: AuthedReq, res: Response, next: NextFunction) {
  try {
    const id = z.string().min(10).parse(req.params.id);
    const prop = await prisma.property.findUnique({ where: { id }, select: { landlordId: true } });
    if (!prop) return res.status(404).json({ status: 404, message: 'Property not found.' });
    const isAdmin = req.user?.role === 'ADMIN';
    const isOwner = req.user?.id === prop.landlordId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ status: 403, message: 'Forbidden: not owner/admin.' });
    }
    return next();
  } catch (e) {
    return mapPrismaError(e, req, res, next);
  }
}

/* -------------------------- Routes -------------------------- */

// GET /api/properties
router.get('/', async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);

    const where: Prisma.PropertyWhereInput = {
      status: q.status,
      divisionId: q.divisionId,
      districtId: q.districtId,
      upazilaId: q.upazilaId,
      rentMonthly:
        q.minRent || q.maxRent
          ? { gte: q.minRent ?? undefined, lte: q.maxRent ?? undefined }
          : undefined,
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { description: { contains: q.q, mode: 'insensitive' } },
              { addressLine: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.PropertyOrderByWithRelationInput[] =
      q.sort === 'rentAsc'
        ? [{ rentMonthly: 'asc' }]
        : q.sort === 'rentDesc'
        ? [{ rentMonthly: 'desc' }]
        : [{ createdAt: 'desc' }];

    const [items, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: selectBasic(),
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      data: items,
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        hasNext: q.page * q.limit < total,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/properties/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = z.string().min(10).parse(req.params.id);
    const data = await prisma.property.findUnique({ where: { id }, select: selectBasic() });
    if (!data) return res.status(404).json({ status: 404, message: 'Property not found.' });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// POST /api/properties (LANDLORD or ADMIN)
router.post(
  '/',
  requireAuth,
  requireRole('LANDLORD', 'ADMIN'),
  async (req: AuthedReq, res: Response, next: NextFunction) => {
    try {
      const body = createBody.parse(req.body);
      const landlordId = req.user!.id;

      const created = await prisma.property.create({
        data: {
          ...body,
          landlordId,
          // status defaults to LISTED in schema
        },
        select: selectBasic(),
      });

      res.status(201).json(created);
    } catch (e) {
      mapPrismaError(e, req, res, next);
    }
  }
);

// PATCH /api/properties/:id (owner or admin)
router.patch(
  '/:id',
  requireAuth,
  ensureOwnerOrAdmin,
  async (req: AuthedReq, res: Response, next: NextFunction) => {
    try {
      const id = z.string().min(10).parse(req.params.id);
      const body = updateBody.parse(req.body);

      const updated = await prisma.property.update({
        where: { id },
        data: body,
        select: selectBasic(),
      });

      res.json(updated);
    } catch (e) {
      mapPrismaError(e, req, res, next);
    }
  }
);

// DELETE /api/properties/:id (owner or admin)
router.delete(
  '/:id',
  requireAuth,
  ensureOwnerOrAdmin,
  async (req: AuthedReq, res: Response, next: NextFunction) => {
    try {
      const id = z.string().min(10).parse(req.params.id);
      await prisma.property.delete({ where: { id } });
      res.status(204).send();
    } catch (e) {
      mapPrismaError(e, req, res, next);
    }
  }
);

export default router;

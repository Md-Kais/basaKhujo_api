// src/modules/location/location.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma';
import { cached } from '../../utils/cache';
import { z } from 'zod';

const router = Router();
const ONE_DAY = 60 * 60 * 24;

const IdParam = z.object({ id: z.coerce.number().int().positive() });
function ensureId(req: Request, res: Response): number | undefined {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ status: 400, message: 'Invalid id', issues: parsed.error.issues });
    return;
  }
  return parsed.data.id;
}

// GET /api/locations/divisions
router.get('/divisions', async (_req, res, next) => {
  try {
    const data = await cached('loc:divisions', ONE_DAY, () =>
      prisma.division.findMany({ orderBy: { id: 'asc' } })
    );
    res.json(data);
  } catch (e) { next(e); }
});

// (optional) GET /api/locations/divisions/:id
router.get('/divisions/:id', async (req, res, next) => {
  try {
    const id = ensureId(req, res); if (id === undefined) return;
    const data = await cached(`loc:division:${id}`, ONE_DAY, () =>
      prisma.division.findUnique({ where: { id } })
    );
    if (!data) return res.status(404).json({ status: 404, message: 'Division not found.' });
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/locations/divisions/:id/districts
router.get('/divisions/:id/districts', async (req, res, next) => {
  try {
    const id = ensureId(req, res); if (id === undefined) return;
    const exists = await prisma.division.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ status: 404, message: 'Division not found.' });

    const data = await cached(`loc:districts:${id}`, ONE_DAY, () =>
      prisma.district.findMany({ where: { divisionId: id }, orderBy: { id: 'asc' } })
    );
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/locations/districts/:id/upazilas
router.get('/districts/:id/upazilas', async (req, res, next) => {
  try {
    const id = ensureId(req, res); if (id === undefined) return;
    const exists = await prisma.district.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ status: 404, message: 'District not found.' });

    const data = await cached(`loc:upazilas:${id}`, ONE_DAY, () =>
      prisma.upazila.findMany({ where: { districtId: id }, orderBy: { id: 'asc' } })
    );
    res.json(data);
  } catch (e) { next(e); }
});

export default router;

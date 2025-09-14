import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { cached } from '../../utils/cache';
import { z } from 'zod';

const router = Router();

// GET /api/locations/divisions
router.get('/divisions', async (_req, res) => {
  const data = await cached('loc:divisions', 60 * 60 * 24, async () =>
    prisma.division.findMany({ orderBy: { id: 'asc' } })
  );
  res.json(data);
});

// GET /api/locations/divisions/:id/districts
router.get('/divisions/:id/districts', async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const data = await cached(`loc:districts:${id}`, 60 * 60 * 24, async () =>
    prisma.district.findMany({ where: { divisionId: id }, orderBy: { id: 'asc' } })
  );
  res.json(data);
});

// GET /api/locations/districts/:id/upazilas
router.get('/districts/:id/upazilas', async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const data = await cached(`loc:upazilas:${id}`, 60 * 60 * 24, async () =>
    prisma.upazila.findMany({ where: { districtId: id }, orderBy: { id: 'asc' } })
  );
  res.json(data);
});

export default router;

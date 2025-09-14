"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../db/prisma");
const cache_1 = require("../../utils/cache");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// GET /api/locations/divisions
router.get('/divisions', async (_req, res) => {
    const data = await (0, cache_1.cached)('loc:divisions', 60 * 60 * 24, async () => prisma_1.prisma.division.findMany({ orderBy: { id: 'asc' } }));
    res.json(data);
});
// GET /api/locations/divisions/:id/districts
router.get('/divisions/:id/districts', async (req, res) => {
    const { id } = zod_1.z.object({ id: zod_1.z.coerce.number().int().positive() }).parse(req.params);
    const data = await (0, cache_1.cached)(`loc:districts:${id}`, 60 * 60 * 24, async () => prisma_1.prisma.district.findMany({ where: { divisionId: id }, orderBy: { id: 'asc' } }));
    res.json(data);
});
// GET /api/locations/districts/:id/upazilas
router.get('/districts/:id/upazilas', async (req, res) => {
    const { id } = zod_1.z.object({ id: zod_1.z.coerce.number().int().positive() }).parse(req.params);
    const data = await (0, cache_1.cached)(`loc:upazilas:${id}`, 60 * 60 * 24, async () => prisma_1.prisma.upazila.findMany({ where: { districtId: id }, orderBy: { id: 'asc' } }));
    res.json(data);
});
exports.default = router;

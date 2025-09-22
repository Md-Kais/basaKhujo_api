"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/location/location.routes.ts
const express_1 = require("express");
const prisma_1 = require("../../db/prisma");
const cache_1 = require("../../utils/cache");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const ONE_DAY = 60 * 60 * 24;
const IdParam = zod_1.z.object({ id: zod_1.z.coerce.number().int().positive() });
function ensureId(req, res) {
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
        const data = await (0, cache_1.cached)('loc:divisions', ONE_DAY, () => prisma_1.prisma.division.findMany({ orderBy: { id: 'asc' } }));
        res.json(data);
    }
    catch (e) {
        next(e);
    }
});
// (optional) GET /api/locations/divisions/:id
router.get('/divisions/:id', async (req, res, next) => {
    try {
        const id = ensureId(req, res);
        if (id === undefined)
            return;
        const data = await (0, cache_1.cached)(`loc:division:${id}`, ONE_DAY, () => prisma_1.prisma.division.findUnique({ where: { id } }));
        if (!data)
            return res.status(404).json({ status: 404, message: 'Division not found.' });
        res.json(data);
    }
    catch (e) {
        next(e);
    }
});
// GET /api/locations/divisions/:id/districts
router.get('/divisions/:id/districts', async (req, res, next) => {
    try {
        const id = ensureId(req, res);
        if (id === undefined)
            return;
        const exists = await prisma_1.prisma.division.findUnique({ where: { id }, select: { id: true } });
        if (!exists)
            return res.status(404).json({ status: 404, message: 'Division not found.' });
        const data = await (0, cache_1.cached)(`loc:districts:${id}`, ONE_DAY, () => prisma_1.prisma.district.findMany({ where: { divisionId: id }, orderBy: { id: 'asc' } }));
        res.json(data);
    }
    catch (e) {
        next(e);
    }
});
// GET /api/locations/districts/:id/upazilas
router.get('/districts/:id/upazilas', async (req, res, next) => {
    try {
        const id = ensureId(req, res);
        if (id === undefined)
            return;
        const exists = await prisma_1.prisma.district.findUnique({ where: { id }, select: { id: true } });
        if (!exists)
            return res.status(404).json({ status: 404, message: 'District not found.' });
        const data = await (0, cache_1.cached)(`loc:upazilas:${id}`, ONE_DAY, () => prisma_1.prisma.upazila.findMany({ where: { districtId: id }, orderBy: { id: 'asc' } }));
        res.json(data);
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;

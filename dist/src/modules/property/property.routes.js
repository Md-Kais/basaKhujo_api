"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../db/prisma");
const auth_1 = require("../../middlewares/auth");
const cache_1 = require("../../utils/cache");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const q = zod_1.z.object({
        divisionId: zod_1.z.string().optional(),
        districtId: zod_1.z.string().optional(),
        upazilaId: zod_1.z.string().optional(),
        rentMin: zod_1.z.string().optional(),
        rentMax: zod_1.z.string().optional(),
        beds: zod_1.z.string().optional(),
        baths: zod_1.z.string().optional(),
        type: zod_1.z.string().optional(),
        q: zod_1.z.string().optional(),
        page: zod_1.z.string().default('1'),
        limit: zod_1.z.string().default('12')
    }).parse(req.query);
    const key = `props:${JSON.stringify(q)}`;
    const data = await (0, cache_1.cached)(key, 60, async () => {
        const where = {};
        if (q.divisionId)
            where.divisionId = Number(q.divisionId);
        if (q.districtId)
            where.districtId = Number(q.districtId);
        if (q.upazilaId)
            where.upazilaId = Number(q.upazilaId);
        if (q.type)
            where.type = q.type;
        if (q.beds)
            where.bedrooms = { gte: Number(q.beds) };
        if (q.baths)
            where.bathrooms = { gte: Number(q.baths) };
        if (q.rentMin || q.rentMax)
            where.rentMonthly = { gte: Number(q.rentMin || 0), lte: Number(q.rentMax || 99999999) };
        if (q.q)
            where.OR = [{ title: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }];
        const page = Number(q.page), limit = Number(q.limit), skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            prisma_1.prisma.property.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { images: true, landlord: { select: { id: true, name: true } } } }),
            prisma_1.prisma.property.count({ where })
        ]);
        return { items, total, page, limit };
    });
    res.json(data);
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('LANDLORD', 'ADMIN'), async (req, res) => {
    const body = zod_1.z.object({
        title: zod_1.z.string().min(3),
        description: zod_1.z.string().min(10),
        rentMonthly: zod_1.z.number(),
        addressLine: zod_1.z.string(),
        divisionId: zod_1.z.number(),
        districtId: zod_1.z.number(),
        upazilaId: zod_1.z.number(),
        bedrooms: zod_1.z.number().optional(),
        bathrooms: zod_1.z.number().optional(),
        type: zod_1.z.string().optional(),
        amenities: zod_1.z.array(zod_1.z.string()).optional()
    }).parse(req.body);
    const prop = await prisma_1.prisma.property.create({
        data: { ...body, landlordId: req.user.id }
    });
    await (0, cache_1.invalidate)('props:*');
    res.status(201).json(prop);
});
exports.default = router;

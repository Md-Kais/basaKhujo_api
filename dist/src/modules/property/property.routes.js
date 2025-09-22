"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/property/property.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../db/prisma");
const client_1 = require("@prisma/client");
// ⬇️ CHANGE this import path if your auth middleware is elsewhere
const auth_1 = require("../../middlewares/auth");
const router = (0, express_1.Router)();
/* -------------------------- Zod Schemas -------------------------- */
const createBody = zod_1.z.object({
    title: zod_1.z.string().min(2),
    description: zod_1.z.string().min(5),
    rentMonthly: zod_1.z.coerce.number().int().positive(),
    deposit: zod_1.z.coerce.number().int().nonnegative().optional(),
    type: zod_1.z.enum(['APARTMENT', 'ROOM', 'HOUSE', 'SUBLET', 'SHOP', 'OFFICE']).optional(),
    bedrooms: zod_1.z.coerce.number().int().min(0).optional(),
    bathrooms: zod_1.z.coerce.number().int().min(0).optional(),
    areaSqft: zod_1.z.coerce.number().int().min(0).optional(),
    amenities: zod_1.z.array(zod_1.z.string()).default([]),
    addressLine: zod_1.z.string().min(2),
    lat: zod_1.z.coerce.number().optional(),
    lon: zod_1.z.coerce.number().optional(),
    availableFrom: zod_1.z.coerce.date().optional(),
    divisionId: zod_1.z.coerce.number().int().positive(),
    districtId: zod_1.z.coerce.number().int().positive(),
    upazilaId: zod_1.z.coerce.number().int().positive(),
});
const updateBody = createBody.partial();
const listQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    status: zod_1.z.nativeEnum(client_1.PropertyStatus).optional(),
    divisionId: zod_1.z.coerce.number().int().positive().optional(),
    districtId: zod_1.z.coerce.number().int().positive().optional(),
    upazilaId: zod_1.z.coerce.number().int().positive().optional(),
    minRent: zod_1.z.coerce.number().int().nonnegative().optional(),
    maxRent: zod_1.z.coerce.number().int().nonnegative().optional(),
    q: zod_1.z.string().trim().optional(),
    sort: zod_1.z.enum(['new', 'rentAsc', 'rentDesc']).default('new'),
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
    };
}
function mapPrismaError(err, _req, res, next) {
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
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
async function ensureOwnerOrAdmin(req, res, next) {
    try {
        const id = zod_1.z.string().min(10).parse(req.params.id);
        const prop = await prisma_1.prisma.property.findUnique({ where: { id }, select: { landlordId: true } });
        if (!prop)
            return res.status(404).json({ status: 404, message: 'Property not found.' });
        const isAdmin = req.user?.role === 'ADMIN';
        const isOwner = req.user?.id === prop.landlordId;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ status: 403, message: 'Forbidden: not owner/admin.' });
        }
        return next();
    }
    catch (e) {
        return mapPrismaError(e, req, res, next);
    }
}
/* -------------------------- Routes -------------------------- */
// GET /api/properties
router.get('/', async (req, res, next) => {
    try {
        const q = listQuery.parse(req.query);
        const where = {
            status: q.status,
            divisionId: q.divisionId,
            districtId: q.districtId,
            upazilaId: q.upazilaId,
            rentMonthly: q.minRent || q.maxRent
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
        const orderBy = q.sort === 'rentAsc'
            ? [{ rentMonthly: 'asc' }]
            : q.sort === 'rentDesc'
                ? [{ rentMonthly: 'desc' }]
                : [{ createdAt: 'desc' }];
        const [items, total] = await Promise.all([
            prisma_1.prisma.property.findMany({
                where,
                orderBy,
                skip: (q.page - 1) * q.limit,
                take: q.limit,
                select: selectBasic(),
            }),
            prisma_1.prisma.property.count({ where }),
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
    }
    catch (e) {
        next(e);
    }
});
// GET /api/properties/:id
router.get('/:id', async (req, res, next) => {
    try {
        const id = zod_1.z.string().min(10).parse(req.params.id);
        const data = await prisma_1.prisma.property.findUnique({ where: { id }, select: selectBasic() });
        if (!data)
            return res.status(404).json({ status: 404, message: 'Property not found.' });
        res.json(data);
    }
    catch (e) {
        next(e);
    }
});
// POST /api/properties (LANDLORD or ADMIN)
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('LANDLORD', 'ADMIN'), async (req, res, next) => {
    try {
        const body = createBody.parse(req.body);
        const landlordId = req.user.id;
        const created = await prisma_1.prisma.property.create({
            data: {
                ...body,
                landlordId,
                // status defaults to LISTED in schema
            },
            select: selectBasic(),
        });
        res.status(201).json(created);
    }
    catch (e) {
        mapPrismaError(e, req, res, next);
    }
});
// PATCH /api/properties/:id (owner or admin)
router.patch('/:id', auth_1.requireAuth, ensureOwnerOrAdmin, async (req, res, next) => {
    try {
        const id = zod_1.z.string().min(10).parse(req.params.id);
        const body = updateBody.parse(req.body);
        const updated = await prisma_1.prisma.property.update({
            where: { id },
            data: body,
            select: selectBasic(),
        });
        res.json(updated);
    }
    catch (e) {
        mapPrismaError(e, req, res, next);
    }
});
// DELETE /api/properties/:id (owner or admin)
router.delete('/:id', auth_1.requireAuth, ensureOwnerOrAdmin, async (req, res, next) => {
    try {
        const id = zod_1.z.string().min(10).parse(req.params.id);
        await prisma_1.prisma.property.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        mapPrismaError(e, req, res, next);
    }
});
exports.default = router;

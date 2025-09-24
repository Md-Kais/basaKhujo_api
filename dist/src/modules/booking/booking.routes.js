"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/booking/booking.router.ts
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../db/prisma");
const auth_1 = require("../../middlewares/auth");
const validate_1 = require("../../middlewares/validate");
const router = (0, express_1.Router)();
/* =========================
   Schemas
========================= */
const idParam = zod_1.z.object({ id: zod_1.z.string().min(1) });
// status filter: single or array, optional
const statusEnum = zod_1.z.enum(['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED']);
const statusFilter = zod_1.z.union([statusEnum, zod_1.z.array(statusEnum)]).optional();
// optional date range (by createdAt)
const dateRange = zod_1.z.object({
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
}).refine(d => !d.from || !d.to || d.from <= d.to, {
    message: 'from must be before to', path: ['to']
});
// landlord requests list query
const landlordListQuery = zod_1.z.object({
    status: statusFilter, // default = REQUESTED (we’ll handle in handler)
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(12),
}).merge(dateRange);
// Common query for landlord lists
const landlordPagedQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(12),
}).merge(dateRange);
const createBookingSchema = zod_1.z.object({
    propertyId: zod_1.z.string().min(1),
    startDate: zod_1.z.coerce.date().optional(), // allow open-ended
    endDate: zod_1.z.coerce.date().optional(),
}).refine((d) => {
    if (d.startDate && d.endDate)
        return d.startDate < d.endDate;
    return true;
}, { message: 'startDate must be before endDate', path: ['endDate'] });
const listQuery = zod_1.z.object({
    as: zod_1.z.enum(['tenant', 'landlord']).optional(),
    status: statusFilter, // NEW
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(12),
}).merge(dateRange);
const confirmBody = zod_1.z.object({
    // optionally set/override start/end at confirmation time
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
});
const completeBody = zod_1.z.object({
    setPropertyListed: zod_1.z.coerce.boolean().default(true),
});
/* =========================
   Helpers
========================= */
/** Overlap check: (newStart < existingEnd) && (newEnd > existingStart) */
async function hasDateConflict(propertyId, start, end) {
    if (!start || !end)
        return false;
    const conflict = await prisma_1.prisma.booking.findFirst({
        where: {
            propertyId,
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            AND: [
                { startDate: { lt: end } },
                { endDate: { gt: start } },
            ],
        },
        select: { id: true },
    });
    return Boolean(conflict);
}
function toStatusArray(input) {
    if (!input)
        return undefined;
    return Array.isArray(input) ? input : [input];
}
function toDateWhere(d) {
    const createdAt = {};
    if (d.from)
        createdAt.gte = d.from;
    if (d.to)
        createdAt.lte = d.to;
    return (d.from || d.to) ? { createdAt } : {};
}
async function listForLandlordByStatus(landlordId, status, page, limit, dr) {
    const where = {
        landlordId,
        status,
        ...toDateWhere(dr),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                tenant: { select: { id: true, name: true, email: true } },
                property: { select: { id: true, title: true, images: true } },
            },
        }),
        prisma_1.prisma.booking.count({ where }),
    ]);
    return { items, total, page, limit, status };
}
/* =========================
   Routes
========================= */
/** POST /api/bookings  (TENANT creates) */
router.post('/', auth_1.requireAuth, (0, validate_1.validate)({ body: createBookingSchema }), async (req, res) => {
    const user = req.user;
    if (user.role !== 'TENANT' && user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only tenants can create bookings' });
    }
    const { propertyId, startDate, endDate } = req.body;
    const property = await prisma_1.prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, landlordId: true, status: true }
    });
    if (!property)
        return res.status(404).json({ message: 'Property not found' });
    if (property.landlordId === user.id)
        return res.status(400).json({ message: 'Cannot book your own property' });
    if (property.status === 'RENTED')
        return res.status(400).json({ message: 'Property is not available' });
    if (await hasDateConflict(propertyId, startDate, endDate)) {
        return res.status(409).json({ message: 'Booking dates conflict with an existing booking' });
    }
    const booking = await prisma_1.prisma.booking.create({
        data: { propertyId, tenantId: user.id, landlordId: property.landlordId, startDate, endDate }
    });
    res.status(201).json(booking);
});
/** PATCH /api/bookings/:id/confirm  (LANDLORD or ADMIN) */
router.patch('/:id/confirm', auth_1.requireAuth, (0, auth_1.requireRole)('LANDLORD', 'ADMIN'), (0, validate_1.validate)({ params: idParam, body: confirmBody }), async (req, res) => {
    const { id } = req.params;
    const me = req.user;
    const { startDate, endDate } = req.body;
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id },
        select: { id: true, status: true, landlordId: true, propertyId: true, startDate: true, endDate: true }
    });
    if (!booking)
        return res.status(404).json({ message: 'Booking not found' });
    if (me.role === 'LANDLORD' && booking.landlordId !== me.id)
        return res.status(403).json({ message: 'Not your booking' });
    if (booking.status !== 'REQUESTED')
        return res.status(400).json({ message: 'Only requested bookings can be confirmed' });
    const s = startDate ?? booking.startDate ?? undefined;
    const e = endDate ?? booking.endDate ?? undefined;
    if (s && e && s >= e)
        return res.status(400).json({ message: 'startDate must be before endDate' });
    if (await hasDateConflict(booking.propertyId, s, e)) {
        return res.status(409).json({ message: 'Booking dates conflict with an existing booking' });
    }
    // Confirm booking and mark property as RENTED atomically
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const b = await tx.booking.update({
            where: { id },
            data: { status: 'CONFIRMED', confirmedAt: new Date(), startDate: s, endDate: e }
        });
        await tx.property.update({
            where: { id: booking.propertyId },
            data: { status: 'RENTED' }
        });
        return b;
    });
    res.json(updated);
});
/** PATCH /api/bookings/:id/cancel  (Tenant or Landlord while REQUESTED) */
router.patch('/:id/cancel', auth_1.requireAuth, (0, validate_1.validate)({ params: idParam }), async (req, res) => {
    const { id } = req.params;
    const me = req.user;
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id },
        select: { id: true, status: true, tenantId: true, landlordId: true }
    });
    if (!booking)
        return res.status(404).json({ message: 'Booking not found' });
    const isParty = booking.tenantId === me.id || booking.landlordId === me.id || me.role === 'ADMIN';
    if (!isParty)
        return res.status(403).json({ message: 'Forbidden' });
    if (booking.status !== 'REQUESTED')
        return res.status(400).json({ message: 'Only requested bookings can be cancelled' });
    const updated = await prisma_1.prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
    res.json(updated);
});
/** PATCH /api/bookings/:id/complete  (LANDLORD or ADMIN) */
router.patch('/:id/complete', auth_1.requireAuth, (0, auth_1.requireRole)('LANDLORD', 'ADMIN'), (0, validate_1.validate)({ params: idParam, body: completeBody }), async (req, res) => {
    const { id } = req.params;
    const me = req.user;
    const { setPropertyListed } = req.body;
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id },
        select: { id: true, status: true, landlordId: true, propertyId: true }
    });
    if (!booking)
        return res.status(404).json({ message: 'Booking not found' });
    if (me.role === 'LANDLORD' && booking.landlordId !== me.id)
        return res.status(403).json({ message: 'Not your booking' });
    if (booking.status !== 'CONFIRMED')
        return res.status(400).json({ message: 'Only confirmed bookings can be completed' });
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const b = await tx.booking.update({ where: { id }, data: { status: 'COMPLETED' } });
        if (setPropertyListed) {
            await tx.property.update({ where: { id: booking.propertyId }, data: { status: 'LISTED' } });
        }
        return b;
    });
    res.json(updated);
});
/** GET /api/bookings  -> my bookings (as tenant or landlord) */
router.get('/', auth_1.requireAuth, (0, validate_1.validate)({ query: listQuery }), async (req, res) => {
    const userId = req.user.id;
    // IMPORTANT: query was validated into res.locals.query by validate()
    const { as, page, limit } = res.locals.query;
    const where = as === 'tenant' ? { tenantId: userId } :
        as === 'landlord' ? { landlordId: userId } :
            { OR: [{ tenantId: userId }, { landlordId: userId }] };
    const [items, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: { property: { select: { id: true, title: true, images: true } } }
        }),
        prisma_1.prisma.booking.count({ where })
    ]);
    res.json({ items, total, page, limit });
});
/** GET /api/bookings/:id (only a party can view) */
router.get('/:id', auth_1.requireAuth, (0, validate_1.validate)({ params: idParam }), async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const booking = await prisma_1.prisma.booking.findFirst({
        where: { id, OR: [{ tenantId: userId }, { landlordId: userId }] },
        include: { property: true }
    });
    if (!booking)
        return res.status(404).json({ message: 'Not found' });
    res.json(booking);
});
/** GET /api/bookings/landlord/stats  -> counts of my bookings by status */
router.get('/landlord/stats', auth_1.requireAuth, (0, validate_1.validate)({ query: dateRange }), async (req, res) => {
    const meId = req.user.id;
    const dr = (res.locals.query ?? {});
    // groupBy landlord's bookings by status
    const grouped = await prisma_1.prisma.booking.groupBy({
        by: ['status'],
        where: {
            landlordId: meId,
            ...toDateWhere(dr)
        },
        _count: { _all: true }
    });
    // normalize to full shape
    const stats = {
        REQUESTED: 0, CONFIRMED: 0, CANCELLED: 0, COMPLETED: 0,
        total: 0
    };
    for (const g of grouped) {
        stats[g.status] = g._count._all;
        stats.total += g._count._all;
    }
    res.json(stats);
});
/** GET /api/bookings/landlord/requests  -> list my bookings by status (default REQUESTED) */
router.get('/landlord/requests', auth_1.requireAuth, (0, validate_1.validate)({ query: landlordListQuery }), async (req, res) => {
    const meId = req.user.id;
    const { status, page, limit, from, to } = res.locals.query;
    // default to REQUESTED if not provided
    const statuses = toStatusArray(status) ?? ['REQUESTED'];
    const baseWhere = {
        landlordId: meId,
        status: { in: statuses }, // filter enum(s)
        ...toDateWhere({ from, to }),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where: baseWhere,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit, // offset pagination
            take: limit,
            include: {
                tenant: { select: { id: true, name: true, email: true } },
                property: { select: { id: true, title: true, images: true } }
            }
        }),
        prisma_1.prisma.booking.count({ where: baseWhere })
    ]);
    res.json({ items, total, page, limit, statuses });
});
/** GET /api/bookings/landlord/confirmed */
router.get('/landlord/confirmed', auth_1.requireAuth, (0, validate_1.validate)({ query: landlordPagedQuery }), async (req, res) => {
    const meId = req.user.id;
    const { page, limit, from, to } = res.locals.query;
    const data = await listForLandlordByStatus(meId, 'CONFIRMED', page, limit, { from, to });
    res.json(data);
});
/** GET /api/bookings/landlord/cancelled */
router.get('/landlord/cancelled', auth_1.requireAuth, (0, validate_1.validate)({ query: landlordPagedQuery }), async (req, res) => {
    const meId = req.user.id;
    const { page, limit, from, to } = res.locals.query;
    const data = await listForLandlordByStatus(meId, 'CANCELLED', page, limit, { from, to });
    res.json(data);
});
/** GET /api/bookings/landlord/completed */
router.get('/landlord/completed', auth_1.requireAuth, (0, validate_1.validate)({ query: landlordPagedQuery }), async (req, res) => {
    const meId = req.user.id;
    const { page, limit, from, to } = res.locals.query;
    const data = await listForLandlordByStatus(meId, 'COMPLETED', page, limit, { from, to });
    res.json(data);
});
exports.default = router;

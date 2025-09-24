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
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(12)
});
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
exports.default = router;

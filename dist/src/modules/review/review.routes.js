"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../db/prisma");
const auth_1 = require("../../middlewares/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const ratingSchema = zod_1.z.object({
    rating: zod_1.z.coerce.number().int().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional()
});
// Utility: 30 days after a date
function addDays(d, days) {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy;
}
// POST /api/reviews/bookings/:id/landlord-review  (tenant)
router.post('/bookings/:id/landlord-review', auth_1.requireAuth, async (req, res) => {
    const { id } = zod_1.z.object({ id: zod_1.z.string().min(1) }).parse(req.params);
    const userId = req.user.id;
    const body = ratingSchema.parse(req.body);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id },
        select: { id: true, status: true, tenantId: true, landlordId: true }
    });
    if (!booking)
        return res.status(404).json({ message: 'Booking not found' });
    if (booking.tenantId !== userId)
        return res.status(403).json({ message: 'Only the tenant can review the landlord' });
    if (booking.status !== 'CONFIRMED')
        return res.status(400).json({ message: 'Review allowed only after confirmation' });
    const exists = await prisma_1.prisma.landlordReview.findUnique({ where: { bookingId: id } });
    if (exists)
        return res.status(400).json({ message: 'Review already exists for this booking' });
    const review = await prisma_1.prisma.landlordReview.create({
        data: {
            bookingId: booking.id,
            landlordId: booking.landlordId,
            reviewerId: userId,
            rating: body.rating,
            comment: body.comment
        }
    });
    res.status(201).json(review);
});
// POST /api/reviews/bookings/:id/property-review  (tenant; >= 30 days after startDate or confirmedAt)
router.post('/bookings/:id/property-review', auth_1.requireAuth, async (req, res) => {
    const { id } = zod_1.z.object({ id: zod_1.z.string().min(1) }).parse(req.params);
    const userId = req.user.id;
    const body = ratingSchema.parse(req.body);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id },
        select: { id: true, status: true, tenantId: true, propertyId: true, startDate: true, confirmedAt: true }
    });
    if (!booking)
        return res.status(404).json({ message: 'Booking not found' });
    if (booking.tenantId !== userId)
        return res.status(403).json({ message: 'Only the tenant can review the property' });
    if (booking.status !== 'CONFIRMED')
        return res.status(400).json({ message: 'Property review allowed only for confirmed bookings' });
    const anchor = booking.startDate ?? booking.confirmedAt;
    if (!anchor)
        return res.status(400).json({ message: 'Booking dates missing for review eligibility' });
    if (new Date() < addDays(anchor, 30)) {
        return res.status(400).json({ message: 'You can review the property 30 days after the start/confirmation date' });
    }
    const exists = await prisma_1.prisma.propertyReview.findUnique({ where: { bookingId: id } });
    if (exists)
        return res.status(400).json({ message: 'Review already exists for this booking' });
    const review = await prisma_1.prisma.propertyReview.create({
        data: {
            bookingId: booking.id,
            propertyId: booking.propertyId,
            reviewerId: userId,
            rating: body.rating,
            comment: body.comment
        }
    });
    res.status(201).json(review);
});
// GET /api/reviews/landlords/:id
router.get('/landlords/:id', async (req, res) => {
    const { id } = zod_1.z.object({ id: zod_1.z.string().min(1) }).parse(req.params);
    const q = zod_1.z.object({
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(12)
    }).parse(req.query);
    const where = { landlordId: id };
    const [items, total] = await Promise.all([
        prisma_1.prisma.landlordReview.findMany({
            where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit
        }),
        prisma_1.prisma.landlordReview.count({ where })
    ]);
    res.json({ items, total, page: q.page, limit: q.limit });
});
// GET /api/reviews/properties/:id
router.get('/properties/:id', async (req, res) => {
    const { id } = zod_1.z.object({ id: zod_1.z.string().min(1) }).parse(req.params);
    const q = zod_1.z.object({
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(12)
    }).parse(req.query);
    const where = { propertyId: id };
    const [items, total] = await Promise.all([
        prisma_1.prisma.propertyReview.findMany({
            where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit
        }),
        prisma_1.prisma.propertyReview.count({ where })
    ]);
    res.json({ items, total, page: q.page, limit: q.limit });
});
exports.default = router;

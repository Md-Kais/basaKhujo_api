// src/modules/booking/booking.router.ts
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';

const router = Router();

/* =========================
   Schemas
========================= */
const idParam = z.object({ id: z.string().min(1) });

// status filter: single or array, optional
const statusEnum = z.enum(['REQUESTED','CONFIRMED','CANCELLED','COMPLETED']);
const statusFilter = z.union([statusEnum, z.array(statusEnum)]).optional();

// optional date range (by createdAt)
const dateRange = z.object({
  from: z.coerce.date().optional(),
  to:   z.coerce.date().optional(),
}).refine(d => !d.from || !d.to || d.from <= d.to, {
  message: 'from must be before to', path: ['to']
});

// landlord requests list query
const landlordListQuery = z.object({
  status: statusFilter,                     // default = REQUESTED (we’ll handle in handler)
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(12),
}).merge(dateRange);

// Common query for landlord lists
const landlordPagedQuery = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
}).merge(dateRange);



const createBookingSchema = z.object({
  propertyId: z.string().min(1),
  startDate: z.coerce.date().optional(), // allow open-ended
  endDate: z.coerce.date().optional(),
}).refine((d) => {
  if (d.startDate && d.endDate) return d.startDate < d.endDate;
  return true;
}, { message: 'startDate must be before endDate', path: ['endDate'] });

const listQuery = z.object({
  as: z.enum(['tenant','landlord']).optional(),
  status: statusFilter, // NEW
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
}).merge(dateRange);

const confirmBody = z.object({
  // optionally set/override start/end at confirmation time
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const completeBody = z.object({
  setPropertyListed: z.coerce.boolean().default(true),
});


/* =========================
   Helpers
========================= */

/** Overlap check: (newStart < existingEnd) && (newEnd > existingStart) */
async function hasDateConflict(propertyId: string, start?: Date, end?: Date) {
  if (!start || !end) return false;
  const conflict = await prisma.booking.findFirst({
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

function toStatusArray(input?: z.infer<typeof statusFilter>) {
  if (!input) return undefined;
  return Array.isArray(input) ? input : [input];
}

function toDateWhere(d: z.infer<typeof dateRange>) {
  const createdAt: Prisma.BookingWhereInput['createdAt'] = {};
  if (d.from) createdAt.gte = d.from;
  if (d.to)   createdAt.lte = d.to;
  return (d.from || d.to) ? { createdAt } : {};
}

async function listForLandlordByStatus(
  landlordId: string,
  status: z.infer<typeof statusEnum>,
  page: number,
  limit: number,
  dr: z.infer<typeof dateRange>,
) {
  const where: Prisma.BookingWhereInput = {
    landlordId,
    status,
    ...toDateWhere(dr),
  };

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        tenant:   { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true, images: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return { items, total, page, limit, status };
}

/* =========================
   Routes
========================= */

/** POST /api/bookings  (TENANT creates) */
router.post(
  '/',
  requireAuth,
  validate({ body: createBookingSchema }),
  async (req: any, res) => {
    const user = req.user as { id: string; role: 'TENANT' | 'LANDLORD' | 'ADMIN' };
    if (user.role !== 'TENANT' && user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only tenants can create bookings' });
    }

    const { propertyId, startDate, endDate } = req.body as z.infer<typeof createBookingSchema>;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, landlordId: true, status: true }
    });
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.landlordId === user.id) return res.status(400).json({ message: 'Cannot book your own property' });
    if (property.status === 'RENTED') return res.status(400).json({ message: 'Property is not available' });

    if (await hasDateConflict(propertyId, startDate, endDate)) {
      return res.status(409).json({ message: 'Booking dates conflict with an existing booking' });
    }

    const booking = await prisma.booking.create({
      data: { propertyId, tenantId: user.id, landlordId: property.landlordId, startDate, endDate }
    });
    res.status(201).json(booking);
  }
);

/** PATCH /api/bookings/:id/confirm  (LANDLORD or ADMIN) */
router.patch(
  '/:id/confirm',
  requireAuth,
  requireRole('LANDLORD', 'ADMIN'),
  validate({ params: idParam, body: confirmBody }),
  async (req: any, res) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const me = req.user as { id: string; role: string };
    const { startDate, endDate } = req.body as z.infer<typeof confirmBody>;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, landlordId: true, propertyId: true, startDate: true, endDate: true }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (me.role === 'LANDLORD' && booking.landlordId !== me.id) return res.status(403).json({ message: 'Not your booking' });
    if (booking.status !== 'REQUESTED') return res.status(400).json({ message: 'Only requested bookings can be confirmed' });

    const s = startDate ?? booking.startDate ?? undefined;
    const e = endDate ?? booking.endDate ?? undefined;
    if (s && e && s >= e) return res.status(400).json({ message: 'startDate must be before endDate' });

    if (await hasDateConflict(booking.propertyId, s, e)) {
      return res.status(409).json({ message: 'Booking dates conflict with an existing booking' });
    }

    // Confirm booking and mark property as RENTED atomically
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
  }
);

/** PATCH /api/bookings/:id/cancel  (Tenant or Landlord while REQUESTED) */
router.patch(
  '/:id/cancel',
  requireAuth,
  validate({ params: idParam }),
  async (req: any, res) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const me = req.user as { id: string; role: string };

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, tenantId: true, landlordId: true }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const isParty = booking.tenantId === me.id || booking.landlordId === me.id || me.role === 'ADMIN';
    if (!isParty) return res.status(403).json({ message: 'Forbidden' });
    if (booking.status !== 'REQUESTED') return res.status(400).json({ message: 'Only requested bookings can be cancelled' });

    const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
    res.json(updated);
  }
);

/** PATCH /api/bookings/:id/complete  (LANDLORD or ADMIN) */
router.patch(
  '/:id/complete',
  requireAuth,
  requireRole('LANDLORD', 'ADMIN'),
  validate({ params: idParam, body: completeBody }),
  async (req: any, res) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const me = req.user as { id: string; role: string };
    const { setPropertyListed } = req.body as z.infer<typeof completeBody>;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, landlordId: true, propertyId: true }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (me.role === 'LANDLORD' && booking.landlordId !== me.id) return res.status(403).json({ message: 'Not your booking' });
    if (booking.status !== 'CONFIRMED') return res.status(400).json({ message: 'Only confirmed bookings can be completed' });

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const b = await tx.booking.update({ where: { id }, data: { status: 'COMPLETED' } });
      if (setPropertyListed) {
        await tx.property.update({ where: { id: booking.propertyId }, data: { status: 'LISTED' } });
      }
      return b;
    });

    res.json(updated);
  }
);

/** GET /api/bookings  -> my bookings (as tenant or landlord) */
router.get(
  '/',
  requireAuth,
  validate({ query: listQuery }),
  async (req: any, res) => {
    const userId = req.user.id as string;

    // IMPORTANT: query was validated into res.locals.query by validate()
    const { as, page, limit } = (res.locals.query as z.infer<typeof listQuery>);


    const where =
      as === 'tenant' ? { tenantId: userId } :
      as === 'landlord' ? { landlordId: userId } :
      { OR: [{ tenantId: userId }, { landlordId: userId }] };

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { property: { select: { id: true, title: true, images: true } } }
      }),
      prisma.booking.count({ where })
    ]);

    res.json({ items, total, page, limit });
  }
);

/** GET /api/bookings/:id (only a party can view) */
router.get(
  '/:id',
  requireAuth,
  validate({ params: idParam }),
  async (req: any, res) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const userId = req.user.id as string;

    const booking = await prisma.booking.findFirst({
      where: { id, OR: [{ tenantId: userId }, { landlordId: userId }] },
      include: { property: true }
    });
    if (!booking) return res.status(404).json({ message: 'Not found' });
    res.json(booking);
  }
);

/** GET /api/bookings/landlord/stats  -> counts of my bookings by status */
router.get(
  '/landlord/stats',
  requireAuth,
  validate({ query: dateRange }),
  async (req: any, res) => {
    const meId = req.user.id as string;
    const dr   = (res.locals.query ?? {}) as z.infer<typeof dateRange>;

    // groupBy landlord's bookings by status
    const grouped = await prisma.booking.groupBy({
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
  }
);


/** GET /api/bookings/landlord/requests  -> list my bookings by status (default REQUESTED) */
router.get(
  '/landlord/requests',
  requireAuth,
  validate({ query: landlordListQuery }),
  async (req: any, res) => {
    const meId = req.user.id as string;
    const { status, page, limit, from, to } = (res.locals.query as z.infer<typeof landlordListQuery>);
    

    // default to REQUESTED if not provided
    const statuses = toStatusArray(status) ?? ['REQUESTED'];

    const baseWhere: Prisma.BookingWhereInput = {
      landlordId: meId,
      status: { in: statuses },            // filter enum(s)
      ...toDateWhere({ from, to }),
    };

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,          // offset pagination
        take: limit,
        include: {
          tenant:   { select: { id: true, name: true, email: true } },
          property: { select: { id: true, title: true, images: true } }
        }
      }),
      prisma.booking.count({ where: baseWhere })
    ]);

    res.json({ items, total, page, limit, statuses });
  }
);

/** GET /api/bookings/landlord/confirmed */
router.get(
  '/landlord/confirmed',
  requireAuth,
  validate({ query: landlordPagedQuery }),
  async (req: any, res) => {
    const meId = req.user.id as string;
    const { page, limit, from, to } = (res.locals.query as z.infer<typeof landlordPagedQuery>);
    const data = await listForLandlordByStatus(meId, 'CONFIRMED', page, limit, { from, to });
    res.json(data);
  }
);

/** GET /api/bookings/landlord/cancelled */
router.get(
  '/landlord/cancelled',
  requireAuth,
  validate({ query: landlordPagedQuery }),
  async (req: any, res) => {
    const meId = req.user.id as string;
    const { page, limit, from, to } = (res.locals.query as z.infer<typeof landlordPagedQuery>);
    const data = await listForLandlordByStatus(meId, 'CANCELLED', page, limit, { from, to });
    res.json(data);
  }
);

/** GET /api/bookings/landlord/completed */
router.get(
  '/landlord/completed',
  requireAuth,
  validate({ query: landlordPagedQuery }),
  async (req: any, res) => {
    const meId = req.user.id as string;
    const { page, limit, from, to } = (res.locals.query as z.infer<typeof landlordPagedQuery>);
    const data = await listForLandlordByStatus(meId, 'COMPLETED', page, limit, { from, to });
    res.json(data);
  }
);



export default router;

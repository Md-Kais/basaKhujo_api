// src/modules/property/image.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// import { v2 as cloudinary } from 'cloudinary';


import { prisma } from '../../db/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { invalidate } from '../../utils/cache';

const router = Router();

const cloudinary = require('cloudinary').v2;
// Configure Cloudinary v2 (or rely on CLOUDINARY_URL env)


/** Multer: in-memory + image-only + 5MB limit */
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed!'));
  },
});

/**
 * Upload a buffer to Cloudinary using a base64 data URI.
 * Uses your upload preset "BasaKhujo".
 */
async function uploadBufferToCloudinary(
  buffer: Buffer,
  mimetype: string,
  folder = 'BasaKhujo',

): Promise<{ secure_url: string; public_id: string }> {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',

  });
  return { secure_url: result.secure_url!, public_id: result.public_id! };
}

/** Schemas */
const propertyIdParam = z.object({ id: z.string().min(1) });
const imageIdParam = z.object({ id: z.string().min(1), imageId: z.string().min(1) });
const setCoverBody = z.object({ isCover: z.boolean().default(true) });
const uploadBody = z.object({ isCover: z.coerce.boolean().optional() });

/** Ensure requester owns the property (or is ADMIN) */
async function assertOwnerOrAdmin(propertyId: string, user: { id: string; role: string }) {
  const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { landlordId: true } });
  if (!prop) throw new Error('Property not found');
  if (user.role !== 'ADMIN' && prop.landlordId !== user.id) throw new Error('Forbidden');
}

/** GET /api/properties/:id/images — public list */
router.get(
  '/:id/images',
  validate({ params: propertyIdParam }),
  async (req, res) => {
    const { id } = req.params as z.infer<typeof propertyIdParam>;
    const images = await prisma.propertyImage.findMany({
      where: { propertyId: id },
      orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(images);
  }
);

/** POST /api/properties/:id/images — upload single */
router.post(
  '/:id/images',
  requireAuth,
  requireRole('LANDLORD', 'ADMIN'),
  validate({ params: propertyIdParam, body: uploadBody }),
  multerUpload.single('file'),
  async (req: any, res) => {
    const { id } = req.params as z.infer<typeof propertyIdParam>;
    await assertOwnerOrAdmin(id, req.user);

    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: 'file is required' });

    const { secure_url, public_id } = await uploadBufferToCloudinary(file.buffer, file.mimetype);
    const isCover = Boolean(req.body?.isCover);

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (isCover) {
        await tx.propertyImage.updateMany({ where: { propertyId: id, isCover: true }, data: { isCover: false } });
      }
      return tx.propertyImage.create({
        data: { propertyId: id, url: secure_url, publicId: public_id, isCover },
      });
    });

    await invalidate('props:*');
    res.status(201).json(created);
  }
);

/** POST /api/properties/:id/images/bulk — upload multiple (max 10) */
router.post(
  '/:id/images/bulk',
  requireAuth,
  requireRole('LANDLORD', 'ADMIN'),
  validate({ params: propertyIdParam }),
  multerUpload.array('files', 10),
  async (req: any, res) => {
    const { id } = req.params as z.infer<typeof propertyIdParam>;
    await assertOwnerOrAdmin(id, req.user);

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ message: 'files[] are required' });

    const uploaded = await Promise.all(
      files.map((f) => uploadBufferToCloudinary(f.buffer, f.mimetype))
    );

    const created = await prisma.propertyImage.createMany({
      data: uploaded.map((u) => ({
        propertyId: id,
        url: u.secure_url,
        publicId: u.public_id,
        isCover: false, // set a cover explicitly via PATCH
      })),
      skipDuplicates: true,
    });

    await invalidate('props:*');
    res.status(201).json({ count: created.count });
  }
);

/** PATCH /api/properties/:id/images/:imageId/cover — set/unset cover */
router.patch(
  '/:id/images/:imageId/cover',
  requireAuth,
  requireRole('LANDLORD', 'ADMIN'),
  validate({ params: imageIdParam, body: setCoverBody }),
  async (req: any, res) => {
    const { id, imageId } = req.params as z.infer<typeof imageIdParam>;
    await assertOwnerOrAdmin(id, req.user);

    const { isCover } = req.body as z.infer<typeof setCoverBody>;
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (isCover) {
        await tx.propertyImage.updateMany({ where: { propertyId: id, isCover: true }, data: { isCover: false } });
      }
      return tx.propertyImage.update({ where: { id: imageId }, data: { isCover } });
    });

    await invalidate('props:*');
    res.json(updated);
  }
);

/** DELETE /api/properties/:id/images/:imageId — remove (Cloudinary + DB) */
router.delete(
  '/:id/images/:imageId',
  requireAuth,
  requireRole('LANDLORD', 'ADMIN'),
  validate({ params: imageIdParam }),
  async (req: any, res) => {
    const { id, imageId } = req.params as z.infer<typeof imageIdParam>;
    await assertOwnerOrAdmin(id, req.user);

    const image = await prisma.propertyImage.findUnique({ where: { id: imageId } });
    if (!image || image.propertyId !== id) return res.status(404).json({ message: 'Image not found' });

    // Delete from Cloudinary (invalidate CDN cache)
    await cloudinary.uploader.destroy(image.publicId, { invalidate: true });

    await prisma.propertyImage.delete({ where: { id: imageId } });
    await invalidate('props:*');
    res.json({ ok: true });
  }
);

export default router;

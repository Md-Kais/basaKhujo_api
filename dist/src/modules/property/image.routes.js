"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/property/image.routes.ts
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const zod_1 = require("zod");
// import { v2 as cloudinary } from 'cloudinary';
const prisma_1 = require("../../db/prisma");
const auth_1 = require("../../middlewares/auth");
const validate_1 = require("../../middlewares/validate");
const cache_1 = require("../../utils/cache");
const router = (0, express_1.Router)();
const cloudinary = require('cloudinary').v2;
// Configure Cloudinary v2 (or rely on CLOUDINARY_URL env)
/** Multer: in-memory + image-only + 5MB limit */
const multerUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            return cb(null, true);
        cb(new Error('Only image files are allowed!'));
    },
});
/**
 * Upload a buffer to Cloudinary using a base64 data URI.
 * Uses your upload preset "BasaKhujo".
 */
async function uploadBufferToCloudinary(buffer, mimetype, folder = 'BasaKhujo') {
    const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: 'image',
    });
    return { secure_url: result.secure_url, public_id: result.public_id };
}
/** Schemas */
const propertyIdParam = zod_1.z.object({ id: zod_1.z.string().min(1) });
const imageIdParam = zod_1.z.object({ id: zod_1.z.string().min(1), imageId: zod_1.z.string().min(1) });
const setCoverBody = zod_1.z.object({ isCover: zod_1.z.boolean().default(true) });
const uploadBody = zod_1.z.object({ isCover: zod_1.z.coerce.boolean().optional() });
/** Ensure requester owns the property (or is ADMIN) */
async function assertOwnerOrAdmin(propertyId, user) {
    const prop = await prisma_1.prisma.property.findUnique({ where: { id: propertyId }, select: { landlordId: true } });
    if (!prop)
        throw new Error('Property not found');
    if (user.role !== 'ADMIN' && prop.landlordId !== user.id)
        throw new Error('Forbidden');
}
/** GET /api/properties/:id/images — public list */
router.get('/:id/images', (0, validate_1.validate)({ params: propertyIdParam }), async (req, res) => {
    const { id } = req.params;
    const images = await prisma_1.prisma.propertyImage.findMany({
        where: { propertyId: id },
        orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(images);
});
/** POST /api/properties/:id/images — upload single */
router.post('/:id/images', auth_1.requireAuth, (0, auth_1.requireRole)('LANDLORD', 'ADMIN'), (0, validate_1.validate)({ params: propertyIdParam, body: uploadBody }), multerUpload.single('file'), async (req, res) => {
    const { id } = req.params;
    await assertOwnerOrAdmin(id, req.user);
    const file = req.file;
    if (!file)
        return res.status(400).json({ message: 'file is required' });
    const { secure_url, public_id } = await uploadBufferToCloudinary(file.buffer, file.mimetype);
    const isCover = Boolean(req.body?.isCover);
    const created = await prisma_1.prisma.$transaction(async (tx) => {
        if (isCover) {
            await tx.propertyImage.updateMany({ where: { propertyId: id, isCover: true }, data: { isCover: false } });
        }
        return tx.propertyImage.create({
            data: { propertyId: id, url: secure_url, publicId: public_id, isCover },
        });
    });
    await (0, cache_1.invalidate)('props:*');
    res.status(201).json(created);
});
/** POST /api/properties/:id/images/bulk — upload multiple (max 10) */
router.post('/:id/images/bulk', auth_1.requireAuth, (0, auth_1.requireRole)('LANDLORD', 'ADMIN'), (0, validate_1.validate)({ params: propertyIdParam }), multerUpload.array('files', 10), async (req, res) => {
    const { id } = req.params;
    await assertOwnerOrAdmin(id, req.user);
    const files = req.files || [];
    if (!files.length)
        return res.status(400).json({ message: 'files[] are required' });
    const uploaded = await Promise.all(files.map((f) => uploadBufferToCloudinary(f.buffer, f.mimetype)));
    const created = await prisma_1.prisma.propertyImage.createMany({
        data: uploaded.map((u) => ({
            propertyId: id,
            url: u.secure_url,
            publicId: u.public_id,
            isCover: false, // set a cover explicitly via PATCH
        })),
        skipDuplicates: true,
    });
    await (0, cache_1.invalidate)('props:*');
    res.status(201).json({ count: created.count });
});
/** PATCH /api/properties/:id/images/:imageId/cover — set/unset cover */
router.patch('/:id/images/:imageId/cover', auth_1.requireAuth, (0, auth_1.requireRole)('LANDLORD', 'ADMIN'), (0, validate_1.validate)({ params: imageIdParam, body: setCoverBody }), async (req, res) => {
    const { id, imageId } = req.params;
    await assertOwnerOrAdmin(id, req.user);
    const { isCover } = req.body;
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        if (isCover) {
            await tx.propertyImage.updateMany({ where: { propertyId: id, isCover: true }, data: { isCover: false } });
        }
        return tx.propertyImage.update({ where: { id: imageId }, data: { isCover } });
    });
    await (0, cache_1.invalidate)('props:*');
    res.json(updated);
});
/** DELETE /api/properties/:id/images/:imageId — remove (Cloudinary + DB) */
router.delete('/:id/images/:imageId', auth_1.requireAuth, (0, auth_1.requireRole)('LANDLORD', 'ADMIN'), (0, validate_1.validate)({ params: imageIdParam }), async (req, res) => {
    const { id, imageId } = req.params;
    await assertOwnerOrAdmin(id, req.user);
    const image = await prisma_1.prisma.propertyImage.findUnique({ where: { id: imageId } });
    if (!image || image.propertyId !== id)
        return res.status(404).json({ message: 'Image not found' });
    // Delete from Cloudinary (invalidate CDN cache)
    await cloudinary.uploader.destroy(image.publicId, { invalidate: true });
    await prisma_1.prisma.propertyImage.delete({ where: { id: imageId } });
    await (0, cache_1.invalidate)('props:*');
    res.json({ ok: true });
});
exports.default = router;

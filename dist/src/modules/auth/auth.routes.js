"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../db/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const jwt_1 = require("../../utils/jwt");
const redis_1 = require("../../db/redis");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().optional(),
    role: zod_1.z.enum(['TENANT', 'LANDLORD']).default('TENANT')
});
router.post('/register', async (req, res) => {
    const body = registerSchema.parse(req.body);
    const hash = await bcryptjs_1.default.hash(body.password, 10);
    const user = await prisma_1.prisma.user.create({ data: { email: body.email, passwordHash: hash, role: body.role, name: body.name } });
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
});
router.post('/login', async (req, res) => {
    const { email, password } = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string() }).parse(req.body);
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash)))
        return res.status(401).json({ message: 'Invalid credentials' });
    const access = (0, jwt_1.signAccess)({ id: user.id, role: user.role });
    const refresh = (0, jwt_1.signRefresh)({ id: user.id, role: user.role });
    await redis_1.redis.set(`refresh:${user.id}`, refresh, 'EX', 60 * 60 * 24 * 7);
    res.json({ access, refresh });
});
router.post('/refresh', async (req, res) => {
    const { refresh } = zod_1.z.object({ refresh: zod_1.z.string() }).parse(req.body);
    const decoded = (0, jwt_1.verifyRefresh)(refresh);
    const stored = await redis_1.redis.get(`refresh:${decoded.id}`);
    if (stored !== refresh)
        return res.status(401).json({ message: 'Invalid refresh' });
    const access = (0, jwt_1.signAccess)({ id: decoded.id, role: decoded.role });
    res.json({ access });
});
router.post('/logout', async (req, res) => {
    const { userId } = zod_1.z.object({ userId: zod_1.z.string() }).parse(req.body);
    await redis_1.redis.del(`refresh:${userId}`);
    res.json({ ok: true });
});
exports.default = router;

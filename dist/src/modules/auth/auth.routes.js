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
const requireAuth_1 = require("../../middlewares/requireAuth");
const router = (0, express_1.Router)();
const isProd = process.env.NODE_ENV === 'production';
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().optional(),
    role: zod_1.z.enum(['TENANT', 'LANDLORD']).default('TENANT')
});
const loginSchema = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string() });
function setRefreshCookie(res, token) {
    res.cookie('refresh', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        path: '/api/auth', // limit scope
    });
}
router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid body', issues: parsed.error.issues });
    try {
        const { email, password, role, name } = parsed.data;
        const hash = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: { email: email.toLowerCase(), passwordHash: hash, role, name }
        });
        return res.status(201).json({ id: user.id, email: user.email, role: user.role });
    }
    catch (e) {
        if (e?.code === 'P2002')
            return res.status(409).json({ message: 'Email already registered' });
        return res.status(500).json({ message: 'Database error' });
    }
});
router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid body', issues: parsed.error.issues });
    const { email, password } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    const access = (0, jwt_1.signAccess)({ id: user.id, role: user.role });
    const refresh = (0, jwt_1.signRefresh)({ id: user.id, role: user.role });
    await redis_1.redis.set(`refresh:${user.id}`, refresh, 'EX', 60 * 60 * 24 * 7);
    setRefreshCookie(res, refresh);
    return res.json({ access }); // refresh stays in HttpOnly cookie
});
// Silent refresh (reads the HttpOnly cookie)
router.post('/refresh', async (req, res) => {
    const refreshCookie = req.cookies?.refresh;
    if (!refreshCookie)
        return res.status(401).json({ message: 'No refresh cookie' });
    try {
        const decoded = (0, jwt_1.verifyRefresh)(refreshCookie);
        const stored = await redis_1.redis.get(`refresh:${decoded.id}`);
        if (stored !== refreshCookie)
            return res.status(401).json({ message: 'Invalid refresh' });
        // rotation
        const access = (0, jwt_1.signAccess)({ id: decoded.id, role: decoded.role });
        const newRefresh = (0, jwt_1.signRefresh)({ id: decoded.id, role: decoded.role });
        await redis_1.redis.set(`refresh:${decoded.id}`, newRefresh, 'EX', 60 * 60 * 24 * 7);
        setRefreshCookie(res, newRefresh);
        return res.json({ access });
    }
    catch {
        return res.status(401).json({ message: 'Invalid refresh' });
    }
});
router.post('/logout', requireAuth_1.requireAuth, async (req, res) => {
    await redis_1.redis.del(`refresh:${req.user.id}`);
    res.clearCookie('refresh', { path: '/api/auth' });
    res.json({ ok: true });
});
router.get('/me', requireAuth_1.requireAuth, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, role: true, name: true, createdAt: true }
    });
    if (!user)
        return res.status(404).json({ message: 'User not found' });
    res.json(user);
});
exports.default = router;

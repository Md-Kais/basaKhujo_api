import { Router } from 'express';
import { prisma } from '../../db/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signAccess, signRefresh, verifyRefresh, verifyAccess } from '../../utils/jwt';
import { redis } from '../../db/redis';
import { requireAuth } from '../../middlewares/requireAuth';

const router = Router();
const isProd = process.env.NODE_ENV === 'production';


const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(['TENANT','LANDLORD']).default('TENANT')
});
const loginSchema   = z.object({ email: z.string().email(), password: z.string() });


function setRefreshCookie(res: any, token: string) {
  res.cookie('refresh', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    path: '/api/auth',               // limit scope
  });
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body', issues: parsed.error.issues });

  try {
    const { email, password, role, name } = parsed.data;
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash: hash, role, name }
    });
    return res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ message: 'Email already registered' });
    return res.status(500).json({ message: 'Database error' });
  }
});



router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body', issues: parsed.error.issues });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const access  = signAccess({ id: user.id, role: user.role });
  const refresh = signRefresh({ id: user.id, role: user.role });

  await redis.set(`refresh:${user.id}`, refresh, 'EX', 60*60*24*7);
  setRefreshCookie(res, refresh);

  return res.json({ access }); // refresh stays in HttpOnly cookie
});


// Silent refresh (reads the HttpOnly cookie)
router.post('/refresh', async (req: any, res) => {
  const refreshCookie = req.cookies?.refresh as string | undefined;
  if (!refreshCookie) return res.status(401).json({ message: 'No refresh cookie' });

  try {
    const decoded = verifyRefresh(refreshCookie);
    const stored  = await redis.get(`refresh:${decoded.id}`);
    if (stored !== refreshCookie) return res.status(401).json({ message: 'Invalid refresh' });

    // rotation
    const access     = signAccess({ id: decoded.id, role: decoded.role });
    const newRefresh = signRefresh({ id: decoded.id, role: decoded.role });
    await redis.set(`refresh:${decoded.id}`, newRefresh, 'EX', 60*60*24*7);
    setRefreshCookie(res, newRefresh);

    return res.json({ access });
  } catch {
    return res.status(401).json({ message: 'Invalid refresh' });
  }
});

router.post('/logout', requireAuth, async (req: any, res) => {
  await redis.del(`refresh:${req.user.id}`);
  res.clearCookie('refresh', { path: '/api/auth' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, role: true, name: true, createdAt: true }
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

export default router;

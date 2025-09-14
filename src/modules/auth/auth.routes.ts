import { Router } from 'express';
import { prisma } from '../../db/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signAccess, signRefresh, verifyRefresh } from '../../utils/jwt';
import { redis } from '../../db/redis';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(['TENANT','LANDLORD']).default('TENANT')
});

router.post('/register', async (req, res) => {
  const body = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({ data: { email: body.email, passwordHash: hash, role: body.role, name: body.name }});
  res.status(201).json({ id: user.id, email: user.email, role: user.role });
});

router.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email }});
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid credentials' });
  const access = signAccess({ id: user.id, role: user.role });
  const refresh = signRefresh({ id: user.id, role: user.role });
  await redis.set(`refresh:${user.id}`, refresh, 'EX', 60*60*24*7);
  res.json({ access, refresh });
});

router.post('/refresh', async (req, res) => {
  const { refresh } = z.object({ refresh: z.string() }).parse(req.body);
  const decoded: any = verifyRefresh(refresh);
  const stored = await redis.get(`refresh:${decoded.id}`);
  if (stored !== refresh) return res.status(401).json({ message: 'Invalid refresh' });
  const access = signAccess({ id: decoded.id, role: decoded.role });
  res.json({ access });
});

router.post('/logout', async (req, res) => {
  const { userId } = z.object({ userId: z.string() }).parse(req.body);
  await redis.del(`refresh:${userId}`);
  res.json({ ok: true });
});

export default router;

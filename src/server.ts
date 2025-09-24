import express from 'express';
import cors from 'cors';
import auth from './modules/auth/auth.routes';
import { notFound, errorHandler } from './middlewares/error';
import propertyRoutes from './modules/property/property.routes';
import authRoutes from './modules/auth/auth.routes';
import locationRoutes from './modules/location/location.routes';
import bookingRoutes from './modules/booking/booking.routes';

const app = express();
app.use(cors({
  origin: ['http://localhost:3000'], 
  credentials: true,                 // allow cookies
}));
app.use(express.json());
app.use((req, _res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/')) {
    req.url = req.url.replace(/\/+(\?|$)/, '$1');
  }
  next();
});

app.get('/', (_req, res) => res.status(200).send('BasaKhujo API is running'));
app.get('/health', (_req, res) =>
  res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV || 'dev',
    time: new Date().toISOString(),
  })
);

// your real APIs
app.use('/api/auth', auth);
app.use('/api/locations', locationRoutes);
app.use('/api/properties', propertyRoutes); // etc.
app.use('/api/bookings', bookingRoutes);

// 404 and error handlers go LAST
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 10000;
app.listen(port, () => console.log(`API listening on :${port}`));

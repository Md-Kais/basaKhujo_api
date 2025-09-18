import express from 'express';
import cors from 'cors';
import auth from './modules/auth/auth.routes';
import { notFound, errorHandler } from './middlewares/error';

const app = express();
app.use(cors({
  origin: ['http://localhost:3000'], 
  credentials: true,                 // allow cookies
}));
app.use(express.json());

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
// app.use('/api/properties', propertiesRouter); // etc.

// 404 and error handlers go LAST
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 10000;
app.listen(port, () => console.log(`API listening on :${port}`));

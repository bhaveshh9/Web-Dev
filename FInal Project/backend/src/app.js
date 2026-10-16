import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import cookieSession from 'cookie-session';
import express from 'express';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import teacherRoutes from './routes/teacher.js';
import studentRoutes from './routes/student.js';

export function createApp() {
  const app = express();

  // React dev server may call the API directly (not needed with the Vite proxy)
  app.use(cors({ origin: config.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // Signed cookie session (same idea as the Flask session)
  app.use(
    cookieSession({
      name: 'gt_session',
      keys: [config.secretKey],
      sameSite: 'lax',
      secure: config.secureCookie,
      httpOnly: true,
    }),
  );

  // never cache API responses
  app.use('/api', (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });
    next();
  });

  app.use('/api', authRoutes);
  app.use('/api', teacherRoutes);
  app.use('/api', studentRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built React app (after `npm run build` in /frontend) — optional
  app.use(express.static(config.frontendDist));
  app.get('*', (req, res) => {
    const index = path.join(config.frontendDist, 'index.html');
    if (!fs.existsSync(index)) {
      return res
        .status(404)
        .send('React build not found. Run `npm run dev` in /frontend (http://localhost:5173) or `npm run build`.');
    }
    res.sendFile(index);
  });

  // error handler (JSON for the API)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Server error' });
  });

  return app;
}

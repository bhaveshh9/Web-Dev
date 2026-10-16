import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_DIR = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT) || 5000,
  secretKey: process.env.SECRET_KEY || 'change-me-in-.env',

  // MongoDB (set in backend/.env)
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGO_DB_NAME || 'gemmatutor',

  uploadFolder: path.join(BACKEND_DIR, 'uploads'),
  frontendDist: path.resolve(BACKEND_DIR, '..', 'frontend', 'dist'),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  secureCookie: (process.env.SESSION_COOKIE_SECURE || 'false').toLowerCase() === 'true',
};

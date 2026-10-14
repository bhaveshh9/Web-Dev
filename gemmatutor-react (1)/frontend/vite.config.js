import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, every /api request is proxied to Flask, so the session cookie
// works without any CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});

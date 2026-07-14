import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const app = createApp();

const env = {
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'dev-secret-change-me',
  AUTH_URL: process.env.AUTH_URL ?? 'http://localhost:5173',
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  DATABASE_URL: process.env.DATABASE_URL ?? '',
};

process.env.MOCK_AUTH ??= 'true';

const port = Number(process.env.PORT ?? 3001);

serve(
  {
    fetch: (req) => app.fetch(req, env),
    port,
  },
  (info) => {
    console.log(`API server running on http://localhost:${info.port}`);
  },
);

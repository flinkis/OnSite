import { authHandler } from '@hono/auth-js';
import { Hono } from 'hono';
import { createDb } from './db/index.js';
import { authConfigMiddleware, type AuthEnv } from './middleware/auth.js';
import { locationsRoutes } from './routes/locations.js';
import { presenceRoutes } from './routes/presence.js';
import { scansRoutes } from './routes/scans.js';

function getDb(c: { env: AuthEnv['Bindings'] }) {
  return createDb(c.env.DATABASE_URL);
}

export function createApp() {
  const app = new Hono<AuthEnv>().basePath('/api');

  app.use('*', authConfigMiddleware());
  app.use('/auth/*', authHandler());

  app.get('/health', (c) => c.json({ ok: true }));

  app.route('/scans', scansRoutes(getDb));
  app.route('/locations', locationsRoutes(getDb));
  app.route('/presence', presenceRoutes(getDb));

  return app;
}

export type App = ReturnType<typeof createApp>;

import { env } from 'hono/adapter';
import { authHandler } from '@hono/auth-js';
import { Hono } from 'hono';
import { createDb } from './db/index.js';
import { authConfigMiddleware, type AuthEnv } from './middleware/auth.js';
import { locationsRoutes } from './routes/locations.js';
import { presenceRoutes } from './routes/presence.js';
import { scansRoutes } from './routes/scans.js';

function getDb(c: { env: AuthEnv['Bindings'] }) {
  const bindings = c.env as AuthEnv['Bindings'] | undefined;
  const e = env(c as Parameters<typeof env>[0]);
  const url =
    bindings?.DATABASE_URL ?? e.DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  return createDb(url);
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

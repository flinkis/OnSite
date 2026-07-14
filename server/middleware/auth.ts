import { env } from 'hono/adapter';
import { getAuthUser } from '@hono/auth-js';
import { initAuthConfig } from '@hono/auth-js';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { createAuthConfig, type AppRole } from '../auth.js';

function readEnv(c: Context) {
  const bindings = c.env as AuthEnv['Bindings'] | undefined;
  const e = env(c);
  return {
    authSecret:
      bindings?.AUTH_SECRET ?? e.AUTH_SECRET ?? process.env.AUTH_SECRET ?? '',
    authUrl: bindings?.AUTH_URL ?? e.AUTH_URL ?? process.env.AUTH_URL ?? '',
    googleId:
      bindings?.AUTH_GOOGLE_ID ?? e.AUTH_GOOGLE_ID ?? process.env.AUTH_GOOGLE_ID,
    googleSecret:
      bindings?.AUTH_GOOGLE_SECRET ??
      e.AUTH_GOOGLE_SECRET ??
      process.env.AUTH_GOOGLE_SECRET,
    adminPasswordHash:
      bindings?.ADMIN_PASSWORD_HASH ??
      e.ADMIN_PASSWORD_HASH ??
      process.env.ADMIN_PASSWORD_HASH,
  };
}

export function authConfigMiddleware() {
  return initAuthConfig((c) => {
    const config = readEnv(c);
    return createAuthConfig(config);
  });
}

export type AuthEnv = {
  Variables: {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: AppRole;
    };
  };
  Bindings: {
    AUTH_SECRET: string;
    AUTH_URL: string;
    AUTH_GOOGLE_ID?: string;
    AUTH_GOOGLE_SECRET?: string;
    ADMIN_PASSWORD_HASH?: string;
    DATABASE_URL: string;
  };
};

async function resolveUser(c: Parameters<typeof getAuthUser>[0]) {
  const mockRole = c.req.header('X-Mock-Role');
  if (
    process.env.VERCEL_TARGET_ENV !== 'production' &&
    (process.env.MOCK_AUTH === 'true' || process.env.VITE_AUTH_MODE === 'mock') &&
    (mockRole === 'user' || mockRole === 'admin')
  ) {
    return {
      id: mockRole === 'admin' ? 'admin' : 'mock-user-1',
      name: mockRole === 'admin' ? 'Admin' : 'Test User',
      email: mockRole === 'admin' ? 'admin@local' : 'user@example.com',
      role: mockRole as AppRole,
    };
  }

  const auth = await getAuthUser(c);
  if (!auth?.token?.sub) return null;
  return {
    id: auth.token.sub,
    name: auth.session?.user?.name ?? (auth.token.name as string | undefined),
    email: auth.session?.user?.email ?? (auth.token.email as string | undefined),
    role: (auth.token.role as AppRole) ?? 'user',
  };
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', user);
  await next();
});

export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  c.set('user', user);
  await next();
});

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  if (user.role === 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  c.set('user', user);
  await next();
});

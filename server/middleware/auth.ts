import { getAuthUser } from '@hono/auth-js';
import { initAuthConfig } from '@hono/auth-js';
import { createMiddleware } from 'hono/factory';
import { createAuthConfig, type AppRole } from '../auth.js';

export function authConfigMiddleware() {
  return initAuthConfig((c) =>
    createAuthConfig({
      authSecret: c.env.AUTH_SECRET,
      authUrl: c.env.AUTH_URL,
      googleId: c.env.AUTH_GOOGLE_ID,
      googleSecret: c.env.AUTH_GOOGLE_SECRET,
      adminPasswordHash: c.env.ADMIN_PASSWORD_HASH,
    }),
  );
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

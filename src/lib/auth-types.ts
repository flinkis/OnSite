export type AppRole = 'admin' | 'user';

export interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
}

export interface Session {
  user?: SessionUser;
  role?: AppRole;
  expires?: string;
}

export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? 'real';

/** Mock auth: local dev + Vercel preview only — never production. */
export const IS_MOCK_AUTH =
  AUTH_MODE === 'mock' &&
  import.meta.env.VITE_VERCEL_TARGET_ENV !== 'production';

import type { AppRole, Session } from './auth-types';
import { IS_MOCK_AUTH } from './auth-types';

const MOCK_SESSION_KEY = 'onsite_mock_session';

const mockSessions: Record<AppRole, Session> = {
  user: {
    user: { id: 'mock-user-1', name: 'Test User', email: 'user@example.com' },
    role: 'user',
    expires: new Date(Date.now() + 86400000).toISOString(),
  },
  admin: {
    user: { id: 'admin', name: 'Admin', email: 'admin@local' },
    role: 'admin',
    expires: new Date(Date.now() + 86400000).toISOString(),
  },
};

export async function getSession(): Promise<Session | null> {
  if (IS_MOCK_AUTH) {
    const stored = localStorage.getItem(MOCK_SESSION_KEY) as AppRole | null;
    return stored ? mockSessions[stored] : null;
  }

  const res = await fetch('/api/auth/session');
  if (!res.ok) return null;
  return res.json();
}

export async function signInGoogle(callbackUrl = '/') {
  if (IS_MOCK_AUTH) {
    localStorage.setItem(MOCK_SESSION_KEY, 'user');
    window.location.href = callbackUrl;
    return;
  }
  window.location.href = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export async function signInAdmin(password: string, callbackUrl = '/') {
  if (IS_MOCK_AUTH) {
    if (password === 'admin') {
      localStorage.setItem(MOCK_SESSION_KEY, 'admin');
      window.location.href = callbackUrl;
      return { ok: true };
    }
    return { ok: false, error: 'Invalid credentials' };
  }

  const csrfRes = await fetch('/api/auth/csrf');
  const { csrfToken } = await csrfRes.json();

  const res = await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken,
      password,
      callbackUrl,
      json: 'true',
    }),
    redirect: 'manual',
  });

  if (res.status === 200 || res.type === 'opaqueredirect' || res.redirected) {
    window.location.href = callbackUrl;
    return { ok: true };
  }

  return { ok: false, error: 'Invalid credentials' };
}

export async function signOut() {
  if (IS_MOCK_AUTH) {
    localStorage.removeItem(MOCK_SESSION_KEY);
    window.location.href = '/login';
    return;
  }

  const csrfRes = await fetch('/api/auth/csrf');
  const { csrfToken } = await csrfRes.json();

  await fetch('/api/auth/signout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken }),
  });
  window.location.href = '/login';
}

export function getScanUrl(codeToken: string) {
  const base = window.location.origin;
  return `${base}/scan?t=${codeToken}`;
}

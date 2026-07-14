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

  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function signInGoogle(callbackUrl = '/') {
  if (IS_MOCK_AUTH) {
    localStorage.setItem(MOCK_SESSION_KEY, 'user');
    window.location.href = callbackUrl;
    return;
  }

  const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!csrfRes.ok) {
    throw new Error('Failed to start Google sign-in');
  }
  const { csrfToken } = await csrfRes.json();

  const res = await fetch('/api/auth/signin/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    body: new URLSearchParams({ csrfToken, callbackUrl }),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to start Google sign-in');
  }

  const data = (await res.json()) as { url?: string };
  if (data.url) {
    const next = new URL(data.url, window.location.origin);
    if (!next.searchParams.get('error')) {
      window.location.href = data.url;
      return;
    }
  }

  throw new Error('Failed to start Google sign-in');
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

  const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' });
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
    credentials: 'include',
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

  const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' });
  const { csrfToken } = await csrfRes.json();

  await fetch('/api/auth/signout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken }),
    credentials: 'include',
  });
  window.location.href = '/login';
}

export function getScanUrl(codeToken: string) {
  const base = window.location.origin;
  return `${base}/scan?t=${codeToken}`;
}

export const PENDING_SCAN_SEARCH_KEY = 'onsite_pending_scan';

export function rememberScanRedirect(pathname: string, search: string) {
  if (pathname === '/scan' && search.includes('t=')) {
    sessionStorage.setItem(PENDING_SCAN_SEARCH_KEY, search);
  }
}

export function loginRedirectPath(pathname: string, search: string): string {
  rememberScanRedirect(pathname, search);
  return `/login?callbackUrl=${encodeURIComponent(pathname + search)}`;
}

export function getCallbackTarget(callbackUrl: string | null): string {
  const raw = callbackUrl?.trim();
  if (raw && raw !== '/') {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
  const pending = sessionStorage.getItem(PENDING_SCAN_SEARCH_KEY);
  if (pending) {
    return `/scan${pending.startsWith('?') ? pending : `?${pending}`}`;
  }
  return '/';
}

export function consumePendingScanRedirect() {
  sessionStorage.removeItem(PENDING_SCAN_SEARCH_KEY);
}

export function isScanCheckInCallback(callbackUrl: string): boolean {
  try {
    const url = new URL(callbackUrl, window.location.origin);
    return url.pathname === '/scan' && url.searchParams.has('t');
  } catch {
    return false;
  }
}

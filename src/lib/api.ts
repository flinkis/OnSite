import { IS_MOCK_AUTH } from './auth-types';

export async function getVerificationPayload(): Promise<{
  lat?: number;
  lng?: number;
  accuracy?: number;
}> {
  // v1: honor system — no GPS collected
  // v2: return geolocation from navigator.geolocation.getCurrentPosition()
  return {};
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (IS_MOCK_AUTH) {
    const role = localStorage.getItem('onsite_mock_session');
    if (role === 'user' || role === 'admin') {
      headers['X-Mock-Role'] = role;
    }
  }

  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }

  if (res.headers.get('Content-Type')?.includes('text/csv')) {
    return (await res.text()) as T;
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super((body.message as string) ?? (body.error as string) ?? 'Request failed');
    this.name = 'ApiError';
  }
}

export interface Location {
  id: string;
  name: string;
  codeToken: string;
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  active: boolean;
}

export interface ScanRecord {
  id: string;
  userId?: string;
  userName?: string | null;
  locationId?: string;
  locationName: string;
  scannedAt: string;
  verification: string;
  flagReason?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracyM?: number | null;
}

export interface PresenceEntry {
  userId: string;
  userName: string | null;
  locationId: string;
  locationName: string;
  scannedAt: string;
  verification: string;
}

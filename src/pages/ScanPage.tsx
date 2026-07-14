import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ScanCheckInLogin } from '../components/ScanCheckInLogin';
import {
  ApiError,
  apiFetch,
  getVerificationPayload,
  type ScanRecord,
} from '../lib/api';
import { signOut, PENDING_SCAN_SEARCH_KEY } from '../lib/auth';
import type { Session } from '../lib/auth-types';
import { useAuth } from '../hooks/useAuth';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'submitting' }
  | { kind: 'success'; locationName: string; scannedAt: string }
  | { kind: 'error'; message: string };

function extractToken(value: string): string | null {
  try {
    const url = new URL(value);
    const token = url.searchParams.get('t');
    if (token) return token;
  } catch {
    // Not a URL — might be raw token
  }
  if (/^[0-9a-f-]{36}$/i.test(value)) return value;
  return null;
}

function ScanPageContent({ session }: { session: Session }) {
  const { refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [scanState, setScanState] = useState<ScanState>({ kind: 'idle' });
  const [cameraActive, setCameraActive] = useState(false);
  const submittedTokenRef = useRef<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ['scans', 'me'],
    queryFn: () => apiFetch<{ scans: ScanRecord[] }>('/api/scans/me'),
  });

  const submitScan = useMutation({
    mutationFn: async (token: string) => {
      const gps = await getVerificationPayload();
      return apiFetch<{ scan: { locationName: string; scannedAt: string } }>(
        '/api/scans',
        {
          method: 'POST',
          body: JSON.stringify({ token, gps: Object.keys(gps).length ? gps : undefined }),
        },
      );
    },
    onSuccess: (data) => {
      setScanState({
        kind: 'success',
        locationName: data.scan.locationName,
        scannedAt: data.scan.scannedAt,
      });
      void queryClient.invalidateQueries({ queryKey: ['scans', 'me'] });
      setSearchParams({});
    },
    onError: (err) => {
      submittedTokenRef.current = null;
      if (err instanceof ApiError && err.status === 401) {
        setScanState({ kind: 'idle' });
        void refresh();
        return;
      }
      if (err instanceof ApiError) {
        setScanState({
          kind: 'error',
          message: err.message,
        });
      } else {
        setScanState({ kind: 'error', message: 'Check-in failed. Try again.' });
      }
      setSearchParams({});
    },
  });

  const handleToken = useCallback(
    (token: string) => {
      if (submittedTokenRef.current === token) return;
      if (submitScan.isPending || scanState.kind === 'submitting') return;
      if (scanState.kind === 'success') return;

      submittedTokenRef.current = token;
      setScanState({ kind: 'submitting' });
      if (searchParams.get('t')) {
        setSearchParams({}, { replace: true });
      }
      submitScan.mutate(token);
    },
    [submitScan, scanState.kind, searchParams, setSearchParams],
  );

  useEffect(() => {
    const token = searchParams.get('t');
    if (!token || scanState.kind !== 'idle') return;
    if (submittedTokenRef.current === token) return;
    handleToken(token);
  }, [searchParams, handleToken, scanState.kind]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setCameraActive(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div className="container">
      <div className="header-bar">
        <div>
          <h1 style={{ margin: 0 }}>Check in</h1>
          <p className="muted" style={{ margin: 0 }}>
            {session.user?.name ?? session.user?.email}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <div className="stack">
        {scanState.kind === 'success' && (
          <div className="card">
            <p className="success-text" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              Checked in at {scanState.locationName}
            </p>
            <p className="muted">
              {new Date(scanState.scannedAt).toLocaleString()}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                submittedTokenRef.current = null;
                setScanState({ kind: 'idle' });
                setCameraActive(false);
              }}
            >
              Scan another
            </button>
          </div>
        )}

        {scanState.kind === 'error' && (
          <div className="card">
            <p className="error-text">{scanState.message}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                submittedTokenRef.current = null;
                setScanState({ kind: 'idle' });
              }}
            >
              Try again
            </button>
          </div>
        )}

        {(scanState.kind === 'idle' || scanState.kind === 'scanning') && (
          <div className="card stack">
            {!cameraActive ? (
              <>
                <p>Tap below to start the camera and scan a location QR code.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setCameraActive(true);
                    setScanState({ kind: 'scanning' });
                  }}
                >
                  Start scanning
                </button>
                <p className="muted">
                  Camera not working? Scan the QR with your phone&apos;s camera app —
                  it will open this page and check you in automatically.
                </p>
              </>
            ) : (
              <div className="scanner-wrap">
                <Scanner
                  formats={['qr_code']}
                  onScan={(detected) => {
                    const raw = detected[0]?.rawValue;
                    if (!raw) return;
                    const token = extractToken(raw);
                    if (token) {
                      setCameraActive(false);
                      handleToken(token);
                    }
                  }}
                  onError={() => {
                    setScanState({
                      kind: 'error',
                      message: 'Camera error — try the native camera app instead.',
                    });
                    setCameraActive(false);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {scanState.kind === 'submitting' && (
          <div className="card">
            <p>Checking in…</p>
          </div>
        )}

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Recent check-ins</h2>
          {!history?.scans.length ? (
            <p className="muted">No check-ins yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {history.scans.map((scan) => (
                <li key={scan.id}>
                  {scan.locationName} —{' '}
                  {new Date(scan.scannedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScanPage() {
  const { session, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const qrToken = searchParams.get('t');

  useEffect(() => {
    if (searchParams.get('t')) return;
    const pending = sessionStorage.getItem(PENDING_SCAN_SEARCH_KEY);
    if (!pending) return;
    sessionStorage.removeItem(PENDING_SCAN_SEARCH_KEY);
    const query = pending.startsWith('?') ? pending.slice(1) : pending;
    setSearchParams(new URLSearchParams(query), { replace: true });
  }, [searchParams, setSearchParams]);

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session && qrToken) {
    return <ScanCheckInLogin token={qrToken} />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role === 'admin' && !qrToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <ScanPageContent session={session} />;
}

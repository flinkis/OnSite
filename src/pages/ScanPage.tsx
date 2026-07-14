import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ApiError,
  apiFetch,
  getVerificationPayload,
  type ScanRecord,
} from '../lib/api';
import { signOut } from '../lib/auth';
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

export function ScanPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [scanState, setScanState] = useState<ScanState>({ kind: 'idle' });
  const [cameraActive, setCameraActive] = useState(false);

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
      if (submitScan.isPending || scanState.kind === 'success') return;
      setScanState({ kind: 'submitting' });
      submitScan.mutate(token);
    },
    [submitScan, scanState.kind],
  );

  useEffect(() => {
    const token = searchParams.get('t');
    if (token && scanState.kind === 'idle') {
      handleToken(token);
    }
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
            {session?.user?.name ?? session?.user?.email}
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
              onClick={() => setScanState({ kind: 'idle' })}
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

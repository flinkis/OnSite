import { useEffect, useRef, useState } from 'react';
import {
  clearScanSignInAttempt,
  hasScanSignInBeenAttempted,
  markScanSignInAttempted,
  rememberScanRedirect,
  signInGoogle,
} from '../lib/auth';
import { useAuth } from '../hooks/useAuth';

type Props = {
  token: string;
};

export function ScanCheckInLogin({ token }: Props) {
  const { session, loading } = useAuth();
  const redirectTarget = `/scan?t=${encodeURIComponent(token)}`;
  const [error, setError] = useState('');
  const [manual, setManual] = useState(hasScanSignInBeenAttempted(token));
  const autoSignInRef = useRef(false);

  useEffect(() => {
    rememberScanRedirect('/scan', `?t=${token}`);
  }, [token]);

  useEffect(() => {
    if (session) {
      clearScanSignInAttempt(token);
    }
  }, [session, token]);

  useEffect(() => {
    if (loading || session || manual || autoSignInRef.current) return;
    autoSignInRef.current = true;
    markScanSignInAttempted(token);
    void signInGoogle(redirectTarget).catch(() => {
      autoSignInRef.current = false;
      setManual(true);
      setError('Could not start Google sign-in. Please try again.');
    });
  }, [loading, session, manual, redirectTarget, token]);

  async function handleGoogle() {
    setError('');
    try {
      await signInGoogle(redirectTarget);
    } catch {
      setManual(true);
      setError('Could not start Google sign-in. Please try again.');
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card stack">
        <div>
          <h1 style={{ margin: 0 }}>OnSite</h1>
          <p className="muted">Sign in to complete your location check-in.</p>
        </div>
        {manual || error ? (
          <>
            {error && <p className="error-text">{error}</p>}
            <button type="button" className="btn" onClick={() => void handleGoogle()}>
              Continue with Google
            </button>
          </>
        ) : (
          <p className="muted">Redirecting to Google sign-in…</p>
        )}
      </div>
    </div>
  );
}

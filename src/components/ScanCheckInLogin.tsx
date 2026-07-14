import { useEffect, useRef, useState } from 'react';
import { rememberScanRedirect, signInGoogle } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';

type Props = {
  token: string;
};

export function ScanCheckInLogin({ token }: Props) {
  const { session, loading, refresh } = useAuth();
  const redirectTarget = `/scan?t=${encodeURIComponent(token)}`;
  const [error, setError] = useState('');
  const autoSignInRef = useRef(false);

  useEffect(() => {
    rememberScanRedirect('/scan', `?t=${token}`);
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading || session || autoSignInRef.current) return;
    autoSignInRef.current = true;
    void signInGoogle(redirectTarget).catch(() => {
      autoSignInRef.current = false;
      setError('Could not start Google sign-in. Please try again.');
    });
  }, [loading, session, redirectTarget]);

  async function handleGoogle() {
    setError('');
    try {
      await signInGoogle(redirectTarget);
    } catch {
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
        {error ? (
          <>
            <p className="error-text">{error}</p>
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

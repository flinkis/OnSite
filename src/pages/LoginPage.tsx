import { useState, useEffect, useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { IS_MOCK_AUTH } from '../lib/auth-types';
import {
  consumePendingScanRedirect,
  getCallbackTarget,
  isScanCheckInCallback,
  rememberScanRedirect,
  signInAdmin,
  signInGoogle,
  toNavigateTarget,
} from '../lib/auth';

export function LoginPage() {
  const { session, loading, refresh } = useAuth();
  const [searchParams] = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const redirectTarget = getCallbackTarget(callbackUrl);
  const isScanCheckIn = isScanCheckInCallback(callbackUrl);
  const authError = searchParams.get('error');
  const [showAdmin, setShowAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    authError === 'Configuration' ? 'Sign-in is not configured correctly.' : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const autoSignInRef = useRef(false);

  useEffect(() => {
    if (isScanCheckIn) {
      const url = new URL(callbackUrl, window.location.origin);
      rememberScanRedirect(url.pathname, url.search);
    }
  }, [callbackUrl, isScanCheckIn]);

  useEffect(() => {
    if (callbackUrl && callbackUrl !== '/') {
      void refresh();
    }
  }, [callbackUrl, refresh]);

  useEffect(() => {
    if (loading || session || authError || showAdmin || !isScanCheckIn || autoSignInRef.current) {
      return;
    }
    autoSignInRef.current = true;
    void signInGoogle(redirectTarget).catch(() => {
      autoSignInRef.current = false;
      setError('Could not start Google sign-in. Please try again.');
    });
  }, [loading, session, authError, showAdmin, isScanCheckIn, redirectTarget]);

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (session) {
    if (session.role === 'admin' && !isScanCheckIn) {
      return <Navigate to="/dashboard" replace />;
    }
    consumePendingScanRedirect();
    return <Navigate to={toNavigateTarget(redirectTarget)} replace />;
  }

  async function handleGoogle() {
    setError('');
    try {
      await signInGoogle(redirectTarget);
    } catch {
      setError('Could not start Google sign-in. Please try again.');
    }
  }

  async function handleAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await signInAdmin(password, redirectTarget);
    if (!result.ok) {
      setError('Invalid credentials');
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card stack">
        <div>
          <h1 style={{ margin: 0 }}>OnSite</h1>
          <p className="muted">
            {isScanCheckIn
              ? 'Sign in to complete your location check-in.'
              : 'Verify your presence at physical locations.'}
          </p>
        </div>

        <button type="button" className="btn" onClick={() => void handleGoogle()}>
          Continue with Google
        </button>

        {error && !showAdmin && <p className="error-text">{error}</p>}

        {!showAdmin ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowAdmin(true)}
          >
            Admin login
          </button>
        ) : (
          <form className="stack" onSubmit={(e) => void handleAdmin(e)}>
            <div>
              <label className="label" htmlFor="password">
                Admin password
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn" disabled={submitting}>
              Sign in as admin
            </button>
          </form>
        )}

        {IS_MOCK_AUTH && (
          <p className="muted">
            Mock auth enabled — use password <code>admin</code> for admin, or
            Google button for user.
          </p>
        )}
      </div>
    </div>
  );
}

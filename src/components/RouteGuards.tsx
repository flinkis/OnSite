import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    const callbackUrl = location.pathname + location.search;
    return <Navigate to={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} replace />;
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role !== 'admin') {
    return <Navigate to="/scan" replace />;
  }

  return <Outlet />;
}

export function RequireUser() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function RootRedirect() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (session.role === 'admin') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/scan" replace />;
}

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { apiFetch, type Location } from '../lib/api';
import { getScanUrl } from '../lib/auth';

export function PrintQrPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['locations'],
    queryFn: () => apiFetch<{ locations: Location[] }>('/api/locations'),
  });

  const location = data?.locations.find((l) => l.id === id);

  useEffect(() => {
    if (location) {
      document.title = `QR — ${location.name}`;
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="container">
        <p className="error-text">Location not found.</p>
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }

  const url = getScanUrl(location.codeToken);

  return (
    <div className="print-page">
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <Link to="/dashboard">← Back to dashboard</Link>
        <button
          type="button"
          className="btn"
          style={{ marginLeft: '1rem' }}
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>

      <h1>{location.name}</h1>
      <p className="muted">Scan to check in</p>
      <div style={{ display: 'inline-block', padding: '1rem', background: 'white' }}>
        <QRCode value={url} size={256} />
      </div>
      <p className="muted" style={{ marginTop: '1rem', wordBreak: 'break-all' }}>
        {url}
      </p>
    </div>
  );
}

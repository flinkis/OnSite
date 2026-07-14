import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, type Location, type PresenceEntry, type ScanRecord } from '../lib/api';
import { getScanUrl, signOut } from '../lib/auth';

type Tab = 'presence' | 'history' | 'locations' | 'flagged';

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>('presence');

  return (
    <div className="container">
      <div className="header-bar">
        <div>
          <h1 style={{ margin: 0 }}>Admin dashboard</h1>
          <p className="muted" style={{ margin: 0 }}>
            Manage locations, presence, and reports
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <div className="tabs">
        {(
          [
            ['presence', 'Live presence'],
            ['history', 'History & reports'],
            ['locations', 'Locations'],
            ['flagged', 'Flagged scans'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'presence' && <PresenceTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'locations' && <LocationsTab />}
      {tab === 'flagged' && <FlaggedTab />}
    </div>
  );
}

function PresenceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['presence'],
    queryFn: () =>
      apiFetch<{ presence: Record<string, PresenceEntry[]>; windowHours: number }>(
        '/api/presence',
      ),
  });

  if (isLoading) return <p className="muted">Loading presence…</p>;

  const groups = data?.presence ?? {};
  const locations = Object.keys(groups);

  if (!locations.length) {
    return (
      <div className="card">
        <p className="muted">No one checked in during the last {data?.windowHours ?? 4} hours.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      {locations.map((locationName) => (
        <div key={locationName} className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>{locationName}</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {groups[locationName].map((entry) => (
              <li key={entry.userId}>
                {entry.userName ?? entry.userId} —{' '}
                {new Date(entry.scannedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function HistoryTab() {
  const [userId, setUserId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [verification, setVerification] = useState('');

  const queryString = new URLSearchParams({
    ...(userId && { userId }),
    ...(locationId && { locationId }),
    ...(from && { from }),
    ...(to && { to }),
    ...(verification && { verification }),
  }).toString();

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => apiFetch<{ locations: Location[] }>('/api/locations'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['scans', queryString],
    queryFn: () =>
      apiFetch<{ scans: ScanRecord[]; pagination: { total: number } }>(
        `/api/scans?${queryString}`,
      ),
  });

  function exportCsv() {
    window.open(`/api/scans/export?${queryString}`, '_blank');
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row">
          <input
            className="input"
            placeholder="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{ maxWidth: 200 }}
          />
          <select
            className="input"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">All locations</option>
            {locationsData?.locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
            style={{ maxWidth: 160 }}
          >
            <option value="">All statuses</option>
            <option value="none">None</option>
            <option value="flagged">Flagged</option>
            <option value="gps">GPS</option>
          </select>
        </div>
        <div className="row">
          <input
            type="datetime-local"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value ? new Date(e.target.value).toISOString() : '')}
            style={{ maxWidth: 220 }}
          />
          <input
            type="datetime-local"
            className="input"
            value={to ? new Date(to).toISOString().slice(0, 16) : ''}
            onChange={(e) => setTo(e.target.value ? new Date(e.target.value).toISOString() : '')}
            style={{ maxWidth: 220 }}
          />
          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="card table-wrap">
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : !data?.scans.length ? (
          <p className="muted">No scans match your filters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Location</th>
                <th>Status</th>
                <th>Flag reason</th>
              </tr>
            </thead>
            <tbody>
              {data.scans.map((scan) => (
                <tr key={scan.id}>
                  <td>{new Date(scan.scannedAt).toLocaleString()}</td>
                  <td>{scan.userName ?? scan.userId}</td>
                  <td>{scan.locationName}</td>
                  <td>
                    <span className={`badge badge-${scan.verification}`}>
                      {scan.verification}
                    </span>
                  </td>
                  <td>{scan.flagReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.pagination && (
          <p className="muted">{data.pagination.total} total scans</p>
        )}
      </div>
    </div>
  );
}

function LocationsTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [confirmRotate, setConfirmRotate] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => apiFetch<{ locations: Location[] }>('/api/locations'),
  });

  const createLocation = useMutation({
    mutationFn: () =>
      apiFetch<{ location: Location }>('/api/locations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          lat: lat ? Number(lat) : undefined,
          lng: lng ? Number(lng) : undefined,
        }),
      }),
    onSuccess: () => {
      setName('');
      setLat('');
      setLng('');
      void queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch(`/api/locations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  const rotateToken = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ location: Location }>(`/api/locations/${id}/rotate`, {
        method: 'POST',
      }),
    onSuccess: () => {
      setConfirmRotate(null);
      void queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  return (
    <div className="stack">
      <div className="card stack">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add location</h2>
        <input
          className="input"
          placeholder="Location name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="row">
          <input
            className="input"
            placeholder="Latitude (optional, for v2)"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <input
            className="input"
            placeholder="Longitude (optional)"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn"
          disabled={!name.trim() || createLocation.isPending}
          onClick={() => createLocation.mutate()}
        >
          Create location
        </button>
      </div>

      <div className="card table-wrap">
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Coordinates</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.locations.map((loc) => (
                <tr key={loc.id}>
                  <td>{loc.name}</td>
                  <td>{loc.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    {loc.lat != null && loc.lng != null
                      ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
                      : '—'}
                  </td>
                  <td>
                    <div className="row">
                      <Link to={`/print/${loc.id}`} className="btn btn-secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}>
                        Print QR
                      </Link>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                        onClick={() =>
                          toggleActive.mutate({ id: loc.id, active: !loc.active })
                        }
                      >
                        {loc.active ? 'Deactivate' : 'Activate'}
                      </button>
                      {confirmRotate === loc.id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                            onClick={() => rotateToken.mutate(loc.id)}
                          >
                            Confirm rotate
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                            onClick={() => setConfirmRotate(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                          onClick={() => setConfirmRotate(loc.id)}
                        >
                          Rotate token
                        </button>
                      )}
                    </div>
                    <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.75rem' }}>
                      {getScanUrl(loc.codeToken)}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FlaggedTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['scans', 'flagged'],
    queryFn: () =>
      apiFetch<{ scans: ScanRecord[] }>('/api/scans?verification=flagged&limit=100'),
  });

  return (
    <div className="card table-wrap">
      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : !data?.scans.length ? (
        <p className="muted">No flagged scans.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Location</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {data.scans.map((scan) => (
              <tr key={scan.id}>
                <td>{new Date(scan.scannedAt).toLocaleString()}</td>
                <td>{scan.userName ?? scan.userId}</td>
                <td>{scan.locationName}</td>
                <td>{scan.flagReason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

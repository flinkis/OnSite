import { and, desc, eq, gte, isNull, ne, or } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { locations, scans } from '../db/schema.js';
import { PRESENCE_WINDOW_HOURS } from '../lib/geo.js';
import type { AuthEnv } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';

type PresenceRow = {
  userId: string;
  userName: string | null;
  locationId: string | null;
  locationName: string;
  scannedAt: Date;
  verification: string;
};

function personKey(row: { userId: string; userName: string | null }) {
  const name = row.userName?.trim().toLowerCase();
  return name || row.userId;
}

export function presenceRoutes(getDb: (c: { env: AuthEnv['Bindings'] }) => Db) {
  const app = new Hono<AuthEnv>();

  app.use('*', requireAdmin);

  app.get('/', async (c) => {
    const db = getDb(c);
    const hours = Number(c.req.query('hours') ?? PRESENCE_WINDOW_HOURS);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const allScans = await db
      .selectDistinctOn([scans.userId], {
        userId: scans.userId,
        userName: scans.userName,
        locationId: scans.locationId,
        locationName: locations.name,
        scannedAt: scans.scannedAt,
        verification: scans.verification,
      })
      .from(scans)
      .innerJoin(locations, eq(scans.locationId, locations.id))
      .where(
        and(
          gte(scans.scannedAt, cutoff),
          or(isNull(scans.flagReason), ne(scans.flagReason, 'duplicate')),
        ),
      )
      .orderBy(scans.userId, desc(scans.scannedAt));

    const latestByPerson = new Map<string, PresenceRow>();
    const sorted = [...allScans].sort(
      (a, b) => b.scannedAt.getTime() - a.scannedAt.getTime(),
    );
    for (const scan of sorted) {
      const key = personKey(scan);
      if (!latestByPerson.has(key)) {
        latestByPerson.set(key, scan);
      }
    }

    const rows = [...latestByPerson.values()].sort(
      (a, b) => b.scannedAt.getTime() - a.scannedAt.getTime(),
    );

    const grouped = rows.reduce<Record<string, PresenceRow[]>>((acc, row) => {
      const key = row.locationName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    for (const locationName of Object.keys(grouped)) {
      grouped[locationName].sort(
        (a, b) => b.scannedAt.getTime() - a.scannedAt.getTime(),
      );
    }

    return c.json({ presence: grouped, windowHours: hours });
  });

  return app;
}

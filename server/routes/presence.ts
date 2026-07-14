import { desc, eq, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { locations, scans } from '../db/schema.js';
import { PRESENCE_WINDOW_HOURS } from '../lib/geo.js';
import type { AuthEnv } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';

export function presenceRoutes(getDb: (c: { env: AuthEnv['Bindings'] }) => Db) {
  const app = new Hono<AuthEnv>();

  app.use('*', requireAdmin);

  app.get('/', async (c) => {
    const db = getDb(c);
    const hours = Number(c.req.query('hours') ?? PRESENCE_WINDOW_HOURS);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const allScans = await db
      .select({
        userId: scans.userId,
        userName: scans.userName,
        locationId: scans.locationId,
        locationName: locations.name,
        scannedAt: scans.scannedAt,
        verification: scans.verification,
      })
      .from(scans)
      .innerJoin(locations, eq(scans.locationId, locations.id))
      .where(gte(scans.scannedAt, cutoff))
      .orderBy(desc(scans.scannedAt));

    const latestByUser = new Map<string, (typeof allScans)[number]>();
    for (const scan of allScans) {
      if (!latestByUser.has(scan.userId)) {
        latestByUser.set(scan.userId, scan);
      }
    }

    const rows = [...latestByUser.values()];
    const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => {
      const key = row.locationName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    return c.json({ presence: grouped, windowHours: hours });
  });

  return app;
}

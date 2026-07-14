import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { locations, scans } from '../db/schema.js';
import { checkImpossibleTravel, findDuplicateScan } from '../lib/abuse.js';
import { DUPLICATE_WINDOW_MINUTES } from '../lib/geo.js';
import type { AuthEnv } from '../middleware/auth.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';

const createScanSchema = z.object({
  token: z.string().uuid(),
  gps: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number().optional(),
    })
    .optional(),
});

export function scansRoutes(getDb: (c: { env: AuthEnv['Bindings'] }) => Db) {
  const app = new Hono<AuthEnv>();

  app.post('/', requireUser, async (c) => {
    const body = createScanSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const db = getDb(c);
    const auth = c.get('user');

    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.codeToken, body.data.token))
      .limit(1);

    if (!location || !location.active) {
      return c.json(
        {
          error: 'invalid_token',
          message: 'This code is no longer valid — contact admin.',
        },
        404,
      );
    }

    const duplicate = await findDuplicateScan(db, auth.id, location.id);
    if (duplicate) {
      return c.json(
        {
          error: 'duplicate',
          message: `Already checked in here at ${duplicate.scannedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          scannedAt: duplicate.scannedAt,
        },
        409,
      );
    }

    const scannedAt = new Date();
    const travel = await checkImpossibleTravel(db, auth.id, location.id, scannedAt);
    const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000);

    const inserted = await db.execute<{ id: string; scanned_at: Date; verification: string }>(sql`
      INSERT INTO scans (
        user_id, user_name, location_id, scanned_at,
        gps_lat, gps_lng, gps_accuracy_m, verification, flag_reason
      )
      SELECT
        ${auth.id},
        ${auth.name ?? auth.email ?? auth.id},
        ${location.id},
        ${scannedAt.toISOString()}::timestamptz,
        ${body.data.gps?.lat ?? null},
        ${body.data.gps?.lng ?? null},
        ${body.data.gps?.accuracy ?? null},
        ${travel.impossible ? 'flagged' : 'none'},
        ${travel.reason ?? null}
      WHERE NOT EXISTS (
        SELECT 1 FROM scans
        WHERE user_id = ${auth.id}
          AND location_id = ${location.id}
          AND scanned_at >= ${cutoff.toISOString()}::timestamptz
      )
      RETURNING id, scanned_at, verification
    `);

    const scanRow = inserted.rows[0];
    if (!scanRow) {
      const raced = await findDuplicateScan(db, auth.id, location.id);
      return c.json(
        {
          error: 'duplicate',
          message: raced
            ? `Already checked in here at ${raced.scannedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Already checked in here recently',
          scannedAt: raced?.scannedAt,
        },
        409,
      );
    }

    if (travel.impossible && travel.previousScanId) {
      await db
        .update(scans)
        .set({ verification: 'flagged', flagReason: 'impossible_travel' })
        .where(eq(scans.id, travel.previousScanId));
    }

    return c.json({
      scan: {
        id: scanRow.id,
        locationName: location.name,
        scannedAt: scanRow.scanned_at,
        verification: scanRow.verification,
      },
    });
  });

  app.get('/me', requireUser, async (c) => {
    const db = getDb(c);
    const auth = c.get('user');

    const rows = await db
      .select({
        id: scans.id,
        scannedAt: scans.scannedAt,
        verification: scans.verification,
        locationName: locations.name,
      })
      .from(scans)
      .innerJoin(locations, eq(scans.locationId, locations.id))
      .where(eq(scans.userId, auth.id))
      .orderBy(desc(scans.scannedAt))
      .limit(10);

    return c.json({ scans: rows });
  });

  app.get('/', requireAdmin, async (c) => {
    const db = getDb(c);
    const userId = c.req.query('userId');
    const locationId = c.req.query('locationId');
    const verification = c.req.query('verification');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50)));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (userId) conditions.push(eq(scans.userId, userId));
    if (locationId) conditions.push(eq(scans.locationId, locationId));
    if (verification) conditions.push(eq(scans.verification, verification));
    if (from) conditions.push(gte(scans.scannedAt, new Date(from)));
    if (to) conditions.push(lte(scans.scannedAt, new Date(to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: scans.id,
        userId: scans.userId,
        userName: scans.userName,
        locationId: scans.locationId,
        locationName: locations.name,
        scannedAt: scans.scannedAt,
        verification: scans.verification,
        flagReason: scans.flagReason,
        gpsLat: scans.gpsLat,
        gpsLng: scans.gpsLng,
        gpsAccuracyM: scans.gpsAccuracyM,
      })
      .from(scans)
      .innerJoin(locations, eq(scans.locationId, locations.id))
      .where(where)
      .orderBy(desc(scans.scannedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scans)
      .where(where);

    return c.json({
      scans: rows,
      pagination: { page, limit, total: count },
    });
  });

  app.get('/export', requireAdmin, async (c) => {
    const db = getDb(c);
    const userId = c.req.query('userId');
    const locationId = c.req.query('locationId');
    const verification = c.req.query('verification');
    const from = c.req.query('from');
    const to = c.req.query('to');

    const conditions = [];
    if (userId) conditions.push(eq(scans.userId, userId));
    if (locationId) conditions.push(eq(scans.locationId, locationId));
    if (verification) conditions.push(eq(scans.verification, verification));
    if (from) conditions.push(gte(scans.scannedAt, new Date(from)));
    if (to) conditions.push(lte(scans.scannedAt, new Date(to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: scans.id,
        userId: scans.userId,
        userName: scans.userName,
        locationName: locations.name,
        scannedAt: scans.scannedAt,
        verification: scans.verification,
        flagReason: scans.flagReason,
        gpsLat: scans.gpsLat,
        gpsLng: scans.gpsLng,
        gpsAccuracyM: scans.gpsAccuracyM,
      })
      .from(scans)
      .innerJoin(locations, eq(scans.locationId, locations.id))
      .where(where)
      .orderBy(desc(scans.scannedAt));

    const header =
      'id,user_id,user_name,location,scanned_at,verification,flag_reason,gps_lat,gps_lng,gps_accuracy_m';
    const lines = rows.map((r) =>
      [
        r.id,
        r.userId,
        csvEscape(r.userName ?? ''),
        csvEscape(r.locationName),
        r.scannedAt.toISOString(),
        r.verification,
        csvEscape(r.flagReason ?? ''),
        r.gpsLat ?? '',
        r.gpsLng ?? '',
        r.gpsAccuracyM ?? '',
      ].join(','),
    );

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="scans.csv"');
    return c.body([header, ...lines].join('\n'));
  });

  return app;
}

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

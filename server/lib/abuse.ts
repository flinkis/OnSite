import { and, desc, eq, gte, ne } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { locations, scans } from '../db/schema.js';
import {
  DUPLICATE_WINDOW_MINUTES,
  haversineDistanceM,
  maxPlausibleDistanceM,
} from './geo.js';

export async function findDuplicateScan(
  db: Db,
  userId: string,
  locationId: string,
  windowMinutes = DUPLICATE_WINDOW_MINUTES,
) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
  const [existing] = await db
    .select()
    .from(scans)
    .where(
      and(
        eq(scans.userId, userId),
        eq(scans.locationId, locationId),
        gte(scans.scannedAt, cutoff),
      ),
    )
    .orderBy(desc(scans.scannedAt))
    .limit(1);
  return existing ?? null;
}

export async function checkImpossibleTravel(
  db: Db,
  userId: string,
  newLocationId: string,
  scannedAt: Date,
): Promise<{ impossible: boolean; reason?: string; previousScanId?: string }> {
  const [prevScan] = await db
    .select({
      scan: scans,
      location: locations,
    })
    .from(scans)
    .innerJoin(locations, eq(scans.locationId, locations.id))
    .where(and(eq(scans.userId, userId), ne(scans.locationId, newLocationId)))
    .orderBy(desc(scans.scannedAt))
    .limit(1);

  if (!prevScan?.location.lat || !prevScan.location.lng) {
    return { impossible: false };
  }

  const [newLoc] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, newLocationId))
    .limit(1);

  if (!newLoc?.lat || !newLoc?.lng) {
    return { impossible: false };
  }

  const elapsedSeconds =
    (scannedAt.getTime() - prevScan.scan.scannedAt.getTime()) / 1000;
  if (elapsedSeconds <= 0) {
    return { impossible: false };
  }

  const distance = haversineDistanceM(
    prevScan.location.lat,
    prevScan.location.lng,
    newLoc.lat,
    newLoc.lng,
  );
  const maxDistance = maxPlausibleDistanceM(elapsedSeconds);

  if (distance > maxDistance) {
    return {
      impossible: true,
      reason: 'impossible_travel',
      previousScanId: prevScan.scan.id,
    };
  }

  return { impossible: false };
}

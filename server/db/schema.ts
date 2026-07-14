import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  codeToken: uuid('code_token').notNull().unique(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  radiusM: integer('radius_m'),
  active: boolean('active').notNull().default(true),
});

export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  userName: text('user_name'),
  locationId: uuid('location_id').references(() => locations.id),
  scannedAt: timestamp('scanned_at', { withTimezone: true }).notNull().defaultNow(),
  gpsLat: doublePrecision('gps_lat'),
  gpsLng: doublePrecision('gps_lng'),
  gpsAccuracyM: doublePrecision('gps_accuracy_m'),
  verification: text('verification').notNull().default('none'),
  flagReason: text('flag_reason'),
});

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;

export type VerificationStatus = 'none' | 'gps' | 'flagged';

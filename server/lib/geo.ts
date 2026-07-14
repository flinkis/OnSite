/** Earth radius in meters */
const R = 6371000;

export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Minimum plausible travel speed in m/s (~30 km/h urban) */
export const MIN_TRAVEL_SPEED_MPS = 8.33;

/** Default duplicate scan window in minutes */
export const DUPLICATE_WINDOW_MINUTES = 10;

/** Presence window in hours */
export const PRESENCE_WINDOW_HOURS = 4;

/** Max plausible travel distance given elapsed seconds */
export function maxPlausibleDistanceM(elapsedSeconds: number): number {
  return MIN_TRAVEL_SPEED_MPS * elapsedSeconds;
}

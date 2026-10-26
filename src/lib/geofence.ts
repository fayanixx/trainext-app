export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeofenceValidationResult {
  isInside: boolean;
  distanceMeters: number;
  formattedDistance: string;
}

/**
 * Calculates the great-circle distance between two GPS coordinates in meters
 * using the Haversine formula.
 */
export function calculateDistanceMeters(
  point1: Coordinates,
  point2: Coordinates
): number {
  const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1Rad = toRadians(point1.latitude);
  const lat2Rad = toRadians(point2.latitude);

  const deltaLatRad = toRadians(point2.latitude - point1.latitude);
  const deltaLngRad = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLngRad / 2) *
      Math.sin(deltaLngRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Checks if a user's coordinate is within the allowed office geofence radius.
 */
export function validateGeofence(
  userCoords: Coordinates,
  officeCoords: Coordinates,
  radiusMeters: number
): GeofenceValidationResult {
  const distance = calculateDistanceMeters(userCoords, officeCoords);
  const isInside = distance <= radiusMeters;

  let formatted = '';
  if (distance >= 1000) {
    formatted = `${(distance / 1000).toFixed(1)} km`;
  } else {
    formatted = `${distance} meters`;
  }

  return {
    isInside,
    distanceMeters: distance,
    formattedDistance: formatted,
  };
}

/**
 * Formats a duration in milliseconds to rounded hours with 2 decimal points.
 * Used for total hours computation during Time-Out.
 */
export function calculateHoursRendered(
  timeInIso: string,
  timeOutIso: string
): number {
  const start = new Date(timeInIso).getTime();
  const end = new Date(timeOutIso).getTime();

  if (end <= start) return 0;

  const diffMs = end - start;
  const hours = diffMs / (1000 * 60 * 60);

  return Number(hours.toFixed(2));
}
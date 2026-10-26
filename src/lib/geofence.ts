export const EARTH_RADIUS_METERS = 6371000

export interface LatLng {
  latitude: number
  longitude: number
}

export interface Geofence {
  latitude: number
  longitude: number
  radius_meters: number
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

export function haversineDistanceMeters(from: LatLng, to: LatLng): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function isStrictlyWithinGeofence(
  position: LatLng,
  site: Geofence
): boolean {
  return (
    haversineDistanceMeters(position, {
      latitude: site.latitude,
      longitude: site.longitude
    }) < site.radius_meters
  )
}

export function distanceToGeofenceMeters(
  position: LatLng,
  site: Geofence
): number {
  return (
    haversineDistanceMeters(position, {
      latitude: site.latitude,
      longitude: site.longitude
    }) - site.radius_meters
  )
}

export function formatDistanceMeters(meters: number): string {
  const absolute = Math.abs(meters)
  if (absolute < 1000) {
    return `${absolute.toFixed(1)} m`
  }
  return `${(absolute / 1000).toFixed(2)} km`
}

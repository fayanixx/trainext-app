import { describe, expect, test } from 'vitest'
import {
  distanceToGeofenceMeters,
  formatDistanceMeters,
  haversineDistanceMeters,
  isStrictlyWithinGeofence
} from '@/lib/geofence'

describe('haversineDistanceMeters', () => {
  test('returns zero for identical coordinates', () => {
    expect(
      haversineDistanceMeters(
        { latitude: 14.5995, longitude: 120.9842 },
        { latitude: 14.5995, longitude: 120.9842 }
      )
    ).toBe(0)
  })

  test('approximates one degree of latitude', () => {
    const distance = haversineDistanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 }
    )
    expect(distance).toBeCloseTo(111194.93, 0)
  })

  test('is symmetric', () => {
    const from = { latitude: 10.3157, longitude: 123.8854 }
    const to = { latitude: 14.5995, longitude: 120.9842 }
    expect(haversineDistanceMeters(from, to)).toBeCloseTo(
      haversineDistanceMeters(to, from),
      6
    )
  })
})

describe('isStrictlyWithinGeofence', () => {
  const site = {
    latitude: 14.5995,
    longitude: 120.9842,
    radius_meters: 120
  }

  test('accepts a position inside the radius', () => {
    expect(
      isStrictlyWithinGeofence(
        { latitude: 14.5999, longitude: 120.9842 },
        site
      )
    ).toBe(true)
  })

  test('rejects a position outside the radius', () => {
    expect(
      isStrictlyWithinGeofence(
        { latitude: 14.603, longitude: 120.9842 },
        site
      )
    ).toBe(false)
  })

  test('rejects a position exactly on the boundary', () => {
    const point = { latitude: 0, longitude: 0 }
    const center = { latitude: 1, longitude: 0 }
    const exactDistance = haversineDistanceMeters(point, center)
    expect(
      isStrictlyWithinGeofence(point, {
        latitude: center.latitude,
        longitude: center.longitude,
        radius_meters: exactDistance
      })
    ).toBe(false)
  })
})

describe('geofence helpers', () => {
  const site = {
    latitude: 14.5995,
    longitude: 120.9842,
    radius_meters: 120
  }

  test('returns a negative boundary distance inside the fence', () => {
    expect(
      distanceToGeofenceMeters(
        { latitude: 14.5999, longitude: 120.9842 },
        site
      )
    ).toBeLessThan(0)
  })

  test('returns a positive boundary distance outside the fence', () => {
    expect(
      distanceToGeofenceMeters(
        { latitude: 14.603, longitude: 120.9842 },
        site
      )
    ).toBeGreaterThan(0)
  })

  test('formats meters and kilometers', () => {
    expect(formatDistanceMeters(42.25)).toBe('42.3 m')
    expect(formatDistanceMeters(1250)).toBe('1.25 km')
  })
})

import {
  haversineDistance,
  isAccuracyAcceptable,
  isWithinGeofence,
} from '../GeofenceService'
import type { Coordinates, Geofence } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a point that is exactly `distanceM` metres due north of `origin`.
 * Uses the inverse haversine on a fixed bearing (0°) so the resulting
 * haversineDistance back to origin equals distanceM to within floating-point
 * precision.
 */
function pointAtDistance(origin: Coordinates, distanceM: number): Coordinates {
  const R = 6_371_000
  const bearing = 0 // due north
  const δ = distanceM / R
  const φ1 = (origin.latitude * Math.PI) / 180
  const λ1 = (origin.longitude * Math.PI) / 180

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(bearing)
  )
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    )

  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (λ2 * 180) / Math.PI,
  }
}

// ── Known coordinates ─────────────────────────────────────────────────────────

const LONDON: Coordinates = { latitude: 51.5074, longitude: -0.1278 }
const PARIS: Coordinates  = { latitude: 48.8566, longitude:  2.3522 }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GeofenceService', () => {

  // ── haversineDistance ──────────────────────────────────────────────────────

  describe('haversineDistance', () => {
    it('returns ~340 km between London and Paris (±5000 m tolerance)', () => {
      // The haversine result is ~343.5 km; "≈ 340 km" is a rounded figure.
      const dist = haversineDistance(LONDON, PARIS)
      expect(dist).toBeGreaterThan(338_000)
      expect(dist).toBeLessThan(346_000)
    })

    it('returns 0 for the same point', () => {
      expect(haversineDistance(LONDON, LONDON)).toBe(0)
    })

    it('is symmetric: distance(A,B) === distance(B,A)', () => {
      const ab = haversineDistance(LONDON, PARIS)
      const ba = haversineDistance(PARIS, LONDON)
      expect(ab).toBeCloseTo(ba, 6)
    })

    it('returns a non-negative value', () => {
      expect(haversineDistance(LONDON, PARIS)).toBeGreaterThanOrEqual(0)
    })
  })

  // ── isWithinGeofence ───────────────────────────────────────────────────────

  describe('isWithinGeofence', () => {
    const CENTER: Coordinates = { latitude: 51.5, longitude: -0.1 }
    const RADIUS_M = 100

    const fence: Geofence = {
      latitude: CENTER.latitude,
      longitude: CENTER.longitude,
      radius_m: RADIUS_M,
    }

    it('returns inside: true when student is exactly on the radius edge', () => {
      // Place the student exactly RADIUS_M metres away from the centre.
      const edge = pointAtDistance(CENTER, RADIUS_M)
      const result = isWithinGeofence(edge, fence)
      expect(result.inside).toBe(true)
    })

    it('returns inside: true when student is 1 m inside the radius', () => {
      const inside = pointAtDistance(CENTER, RADIUS_M - 1)
      const result = isWithinGeofence(inside, fence)
      expect(result.inside).toBe(true)
    })

    it('returns inside: false with distanceMetres when student is 1 m outside the radius', () => {
      const outside = pointAtDistance(CENTER, RADIUS_M + 1)
      const result = isWithinGeofence(outside, fence)
      expect(result.inside).toBe(false)
      if (!result.inside) {
        expect(result.distanceMetres).toBeGreaterThan(RADIUS_M)
        expect(result.reason).toBe('outside_geofence')
      }
    })

    it('returns inside: true for a student at the centre of the geofence', () => {
      const result = isWithinGeofence(CENTER, fence)
      expect(result.inside).toBe(true)
    })
  })

  // ── isAccuracyAcceptable ───────────────────────────────────────────────────

  describe('isAccuracyAcceptable', () => {
    it('returns true at the threshold (30 m)', () => {
      expect(isAccuracyAcceptable(30)).toBe(true)
    })

    it('returns false just over the threshold (31 m)', () => {
      expect(isAccuracyAcceptable(31)).toBe(false)
    })

    it('returns true for perfect accuracy (0 m)', () => {
      expect(isAccuracyAcceptable(0)).toBe(true)
    })
  })
})

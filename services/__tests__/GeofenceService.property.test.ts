/**
 * Property-Based Tests for GeofenceService
 *
 * Property 8: Haversine Symmetry
 * For all valid coordinate pairs A and B, haversineDistance(A, B) === haversineDistance(B, A)
 *
 * **Validates: Requirements 4.4**
 *
 * Property 9: Haversine Identity
 * For all valid coordinates A, haversineDistance(A, A) === 0
 *
 * **Validates: Requirements 4.3**
 */

import * as fc from 'fast-check'
import { haversineDistance } from '../GeofenceService'
import type { Coordinates } from '../../types'

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a valid Coordinates object with latitude ∈ [-90, 90] and longitude ∈ [-180, 180].
 */
const coordinatesArbitrary: fc.Arbitrary<Coordinates> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
})

// ── Property Tests ────────────────────────────────────────────────────────────

describe('GeofenceService – Property 8: Haversine Symmetry', () => {
  it('haversineDistance(A, B) === haversineDistance(B, A) for all valid coordinate pairs', () => {
    fc.assert(
      fc.property(coordinatesArbitrary, coordinatesArbitrary, (a, b) => {
        const ab = haversineDistance(a, b)
        const ba = haversineDistance(b, a)
        expect(ab).toBeCloseTo(ba, 10)
      }),
      { numRuns: 1000 },
    )
  })
})

describe('GeofenceService – Property 9: Haversine Identity', () => {
  it('haversineDistance(A, A) === 0 for all valid coordinates', () => {
    fc.assert(
      fc.property(coordinatesArbitrary, (a) => {
        const distance = haversineDistance(a, a)
        expect(distance).toBe(0)
      }),
      { numRuns: 1000 },
    )
  })
})

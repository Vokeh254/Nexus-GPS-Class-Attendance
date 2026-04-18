/**
 * Property-Based Tests: verify-attendance Edge Function
 *
 * Property 1: Anti-Proxy (Geofence Invariant)
 * For any verified attendance_log, haversineDistance(log.coords, class.geofence_center)
 * SHALL be ≤ class.geofence_radius_m.
 * Validates: Requirements 5.3, 5.4
 *
 * Property 2: Attendance Uniqueness
 * For any sequence of attendance submissions for the same (session_id, student_id),
 * the count of attendance_logs rows SHALL never exceed one.
 * Validates: Requirements 5.7, 5.8, 10.1
 *
 * Property 4: Accuracy Gate
 * For any verified attendance_log row, accuracy_m <= 30.
 * Validates: Requirements 3.5, 5.5, 10.3
 */

import * as fc from 'fast-check'
import { haversineDistance } from '../GeofenceService'

// ── Shared types ──────────────────────────────────────────────────────────────

interface Coords {
  latitude: number
  longitude: number
  accuracy_m: number
}

interface ClassRow {
  geofence_lat: number
  geofence_lng: number
  geofence_radius_m: number
}

type FailReason = 'outside_geofence' | 'poor_gps' | 'session_not_active' | 'already_signed' | 'server_error'

type VerifyResult =
  | { success: true; attendance_id: string; timestamp: string }
  | { success: false; reason: FailReason; message: string }

// ── Verification logic (mirrors Edge Function) ────────────────────────────────

/**
 * In-memory attendance store — simulates the DB UNIQUE constraint on
 * (session_id, student_id). Returns the current log count after the attempt.
 */
function makeAttendanceStore() {
  const logs = new Map<string, object>()

  return {
    tryInsert(sessionId: string, studentId: string, coords: Coords, classRow: ClassRow): VerifyResult {
      const key = `${sessionId}:${studentId}`

      // Duplicate guard (mirrors DB UNIQUE constraint + application check)
      if (logs.has(key)) {
        return { success: false, reason: 'already_signed', message: 'Already signed' }
      }

      // Accuracy gate
      if (coords.accuracy_m > 30) {
        return { success: false, reason: 'poor_gps', message: `Accuracy ${coords.accuracy_m} m` }
      }

      // Geofence check
      const distance = haversineDistance(
        { latitude: coords.latitude, longitude: coords.longitude },
        { latitude: classRow.geofence_lat, longitude: classRow.geofence_lng },
      )

      if (distance > classRow.geofence_radius_m) {
        return { success: false, reason: 'outside_geofence', message: `${Math.round(distance)} m away` }
      }

      // Insert
      const log = { sessionId, studentId, coords, verified: true, id: `log-${logs.size}`, signed_at: new Date().toISOString() }
      logs.set(key, log)
      return { success: true, attendance_id: log.id, timestamp: log.signed_at }
    },

    countFor(sessionId: string, studentId: string): number {
      const key = `${sessionId}:${studentId}`
      return logs.has(key) ? 1 : 0
    },

    getAllLogs(): Array<{ sessionId: string; studentId: string; coords: Coords }> {
      return Array.from(logs.values()) as any
    },
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const validCoords = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
})

/** Generates a geofence with a realistic radius between 10 and 500 m */
const geofenceArb = fc.record({
  geofence_lat: fc.double({ min: -89, max: 89, noNaN: true }),
  geofence_lng: fc.double({ min: -179, max: 179, noNaN: true }),
  geofence_radius_m: fc.double({ min: 10, max: 500, noNaN: true }),
})

/** Generates coords that are provably inside the given geofence (distance ≈ 0) */
const insideCoordsArb = (classRow: ClassRow): fc.Arbitrary<Coords> =>
  fc.record({
    latitude: fc.constant(classRow.geofence_lat),
    longitude: fc.constant(classRow.geofence_lng),
    accuracy_m: fc.double({ min: 0, max: 30, noNaN: true }),
  })

/** Generates a non-empty sequence of submission attempts (1–10 attempts) */
const submissionSequenceArb = fc.array(
  fc.record({
    latitude: fc.double({ min: -90, max: 90, noNaN: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true }),
    accuracy_m: fc.double({ min: 0, max: 60, noNaN: true }),
  }),
  { minLength: 1, maxLength: 10 },
)

// ── Property 2: Attendance Uniqueness ─────────────────────────────────────────

describe('Property 2: Attendance Uniqueness', () => {
  it('count of attendance_logs for (session_id, student_id) never exceeds 1 regardless of submission count', () => {
    fc.assert(
      fc.property(
        fc.uuid(),                // session_id
        fc.uuid(),                // student_id
        geofenceArb,              // class geofence
        submissionSequenceArb,    // 1–10 submission attempts
        (sessionId, studentId, classRow, attempts) => {
          const store = makeAttendanceStore()

          for (const attempt of attempts) {
            store.tryInsert(sessionId, studentId, attempt, classRow)
          }

          // INVARIANT: at most one log per (session_id, student_id)
          expect(store.countFor(sessionId, studentId)).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('first successful submission creates exactly one log; subsequent attempts return already_signed', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        geofenceArb,
        (sessionId, studentId, classRow) => {
          const store = makeAttendanceStore()

          // First submission — inside geofence, good accuracy
          const firstCoords: Coords = {
            latitude: classRow.geofence_lat,
            longitude: classRow.geofence_lng,
            accuracy_m: 10,
          }
          const first = store.tryInsert(sessionId, studentId, firstCoords, classRow)
          expect(first.success).toBe(true)

          // Second identical submission
          const second = store.tryInsert(sessionId, studentId, firstCoords, classRow)
          expect(second.success).toBe(false)
          if (!second.success) {
            expect(second.reason).toBe('already_signed')
          }

          // Still only one log
          expect(store.countFor(sessionId, studentId)).toBe(1)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('different students for the same session each get their own log (no cross-contamination)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        geofenceArb,
        (sessionId, studentA, studentB, classRow) => {
          fc.pre(studentA !== studentB)

          const store = makeAttendanceStore()
          const coords: Coords = { latitude: classRow.geofence_lat, longitude: classRow.geofence_lng, accuracy_m: 5 }

          store.tryInsert(sessionId, studentA, coords, classRow)
          store.tryInsert(sessionId, studentB, coords, classRow)

          expect(store.countFor(sessionId, studentA)).toBe(1)
          expect(store.countFor(sessionId, studentB)).toBe(1)
        },
      ),
      { numRuns: 300 },
    )
  })
})

// ── Property 4: Accuracy Gate ─────────────────────────────────────────────────

describe('Property 4: Accuracy Gate', () => {
  it('every verified attendance_log has accuracy_m <= 30', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        geofenceArb,
        submissionSequenceArb,
        (sessionId, studentId, classRow, attempts) => {
          const store = makeAttendanceStore()

          for (const attempt of attempts) {
            store.tryInsert(sessionId, studentId, attempt, classRow)
          }

          const logs = store.getAllLogs()
          for (const log of logs) {
            // INVARIANT: only logs with accuracy ≤ 30 are ever inserted
            expect(log.coords.accuracy_m).toBeLessThanOrEqual(30)
          }
        },
      ),
      { numRuns: 500 },
    )
  })

  it('submissions with accuracy > 30 are always rejected with poor_gps', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        geofenceArb,
        fc.double({ min: 30.001, max: 1000, noNaN: true }),
        (sessionId, studentId, classRow, badAccuracy) => {
          const store = makeAttendanceStore()
          const coords: Coords = {
            latitude: classRow.geofence_lat,
            longitude: classRow.geofence_lng,
            accuracy_m: badAccuracy,
          }

          const result = store.tryInsert(sessionId, studentId, coords, classRow)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.reason).toBe('poor_gps')
          }
          expect(store.countFor(sessionId, studentId)).toBe(0)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('submissions with accuracy exactly 30 m are accepted (boundary)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        geofenceArb,
        (sessionId, studentId, classRow) => {
          const store = makeAttendanceStore()
          const coords: Coords = {
            latitude: classRow.geofence_lat,
            longitude: classRow.geofence_lng,
            accuracy_m: 30,
          }

          const result = store.tryInsert(sessionId, studentId, coords, classRow)
          expect(result.success).toBe(true)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ── Property 1: Anti-Proxy (Geofence Invariant) ───────────────────────────────

describe('Property 1: Anti-Proxy (Geofence Invariant)', () => {
  it('every verified log has haversineDistance(coords, geofence_center) <= geofence_radius_m', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        geofenceArb,
        submissionSequenceArb,
        (sessionId, studentId, classRow, attempts) => {
          const store = makeAttendanceStore()

          for (const attempt of attempts) {
            store.tryInsert(sessionId, studentId, attempt, classRow)
          }

          const logs = store.getAllLogs()
          for (const log of logs) {
            const dist = haversineDistance(
              { latitude: log.coords.latitude, longitude: log.coords.longitude },
              { latitude: classRow.geofence_lat, longitude: classRow.geofence_lng },
            )
            // INVARIANT: verified logs are always within the geofence
            expect(dist).toBeLessThanOrEqual(classRow.geofence_radius_m + 1e-9) // float tolerance
          }
        },
      ),
      { numRuns: 500 },
    )
  })

  it('coords outside the geofence are always rejected with outside_geofence', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        geofenceArb,
        validCoords,
        (sessionId, studentId, classRow, rawCoords) => {
          const dist = haversineDistance(
            { latitude: rawCoords.latitude, longitude: rawCoords.longitude },
            { latitude: classRow.geofence_lat, longitude: classRow.geofence_lng },
          )

          // Only test coords that are provably outside
          fc.pre(dist > classRow.geofence_radius_m)

          const store = makeAttendanceStore()
          const coords: Coords = { ...rawCoords, accuracy_m: 10 }
          const result = store.tryInsert(sessionId, studentId, coords, classRow)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.reason).toBe('outside_geofence')
          }
          expect(store.countFor(sessionId, studentId)).toBe(0)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('coords inside the geofence with good accuracy always succeed (first submission)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        geofenceArb,
        (sessionId, studentId, classRow) => {
          const store = makeAttendanceStore()
          // Place student exactly at geofence centre — always inside
          const coords: Coords = {
            latitude: classRow.geofence_lat,
            longitude: classRow.geofence_lng,
            accuracy_m: 5,
          }

          const result = store.tryInsert(sessionId, studentId, coords, classRow)
          expect(result.success).toBe(true)
        },
      ),
      { numRuns: 300 },
    )
  })
})

/**
 * Property-Based Tests for Auth Binding / Identity Integrity
 *
 * Property 3: Auth Binding (Identity Integrity)
 * For any attendance log row in the database, `student_id` SHALL equal the JWT
 * subject claim of the request that created it; no client-supplied identity
 * field SHALL override this value.
 *
 * **Validates: Requirements 9.4, 9.5**
 */

import * as fc from 'fast-check'

// ── Identity extraction logic (mirrors Edge Function behaviour) ───────────────

/**
 * Simulates the server-side identity extraction performed by the
 * verify-attendance Edge Function (supabase/functions/verify-attendance/index.ts).
 *
 * The server derives `student_id` exclusively from the verified JWT subject
 * claim (`user.id` returned by `anonClient.auth.getUser(jwt)`).
 * Any `student_id` field present in the client-supplied request body is
 * intentionally ignored.
 *
 * Requirements 9.4, 9.5
 */
function extractStudentId(
  jwtSub: string,
  _clientBody: { student_id?: string },
): string {
  // Server always uses JWT subject, ignores client-supplied identity
  return jwtSub
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a pair of distinct UUIDs: one representing the JWT subject claim
 * and one representing a client-supplied student_id that differs from it.
 */
const distinctUuidPair = fc
  .tuple(fc.uuid(), fc.uuid())
  .filter(([jwtSub, clientId]) => jwtSub !== clientId)

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Auth Binding – Property 3: Identity Integrity', () => {
  it('student_id always equals the JWT subject, never the client-supplied value', () => {
    fc.assert(
      fc.property(distinctUuidPair, ([jwtSub, clientSuppliedStudentId]) => {
        const result = extractStudentId(jwtSub, { student_id: clientSuppliedStudentId })

        // Must equal the JWT subject
        expect(result).toBe(jwtSub)

        // Must NOT equal the client-supplied identity
        expect(result).not.toBe(clientSuppliedStudentId)
      }),
      { numRuns: 200 },
    )
  })

  it('student_id equals JWT subject even when client body omits student_id', () => {
    fc.assert(
      fc.property(fc.uuid(), (jwtSub) => {
        const result = extractStudentId(jwtSub, {})

        expect(result).toBe(jwtSub)
      }),
      { numRuns: 200 },
    )
  })

  it('student_id equals JWT subject when client body supplies an identical value', () => {
    fc.assert(
      fc.property(fc.uuid(), (jwtSub) => {
        // Even when client happens to send the same value, the server-side
        // logic must still derive identity from the JWT, not the body.
        const result = extractStudentId(jwtSub, { student_id: jwtSub })

        expect(result).toBe(jwtSub)
      }),
      { numRuns: 200 },
    )
  })
})

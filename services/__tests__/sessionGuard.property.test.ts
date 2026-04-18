/**
 * Property-Based Tests for Session Guard
 *
 * Property 6: Session Guard
 * For any attendance submission, the submission SHALL only succeed when the
 * target `class_sessions` record has `is_active = true`.
 *
 * **Validates: Requirements 5.6**
 */

import * as fc from 'fast-check'

// ── Session guard logic (mirrors Edge Function behaviour) ─────────────────────

/**
 * Models the session-active check performed by the verify-attendance Edge
 * Function (supabase/functions/verify-attendance/index.ts, Step 3).
 *
 * The function queries for a session with `is_active = true`. If none is
 * found (null result) or the session is inactive, it returns
 * `'session_not_active'`. Otherwise it returns `'proceed'`.
 *
 * Requirements 5.6
 */
function checkSessionActive(
  session: { is_active: boolean } | null,
): 'session_not_active' | 'proceed' {
  if (!session || !session.is_active) return 'session_not_active'
  return 'proceed'
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a session object with an arbitrary is_active flag. */
const sessionArbitrary = fc.record({ is_active: fc.boolean() })

/** Generates an inactive session (is_active = false). */
const inactiveSessionArbitrary = fc.record({ is_active: fc.constant(false) })

/** Generates an active session (is_active = true). */
const activeSessionArbitrary = fc.record({ is_active: fc.constant(true) })

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Session Guard – Property 6: Session Active Check', () => {
  it('returns session_not_active for any session with is_active = false', () => {
    fc.assert(
      fc.property(inactiveSessionArbitrary, (session) => {
        const result = checkSessionActive(session)
        expect(result).toBe('session_not_active')
      }),
      { numRuns: 200 },
    )
  })

  it('returns proceed for any session with is_active = true', () => {
    fc.assert(
      fc.property(activeSessionArbitrary, (session) => {
        const result = checkSessionActive(session)
        expect(result).toBe('proceed')
      }),
      { numRuns: 200 },
    )
  })

  it('returns session_not_active when session is null (no active session found)', () => {
    fc.assert(
      fc.property(fc.constant(null), (session) => {
        const result = checkSessionActive(session)
        expect(result).toBe('session_not_active')
      }),
      { numRuns: 200 },
    )
  })

  it('result is session_not_active iff session is null or is_active = false', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), sessionArbitrary),
        (session) => {
          const result = checkSessionActive(session)
          const shouldBlock = session === null || !session.is_active
          if (shouldBlock) {
            expect(result).toBe('session_not_active')
          } else {
            expect(result).toBe('proceed')
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

/**
 * Property-Based Tests for AuthService
 *
 * Property 12: Session Storage Round-Trip
 * For any simulated successful auth result, the session written to SecureStore
 * SHALL be retrievable and structurally equivalent to the original session object.
 *
 * Validates: Requirements 1.1
 */

import * as fc from 'fast-check'
import * as SecureStore from 'expo-secure-store'
import { AuthService } from '../AuthService'
import type { Session, User, SupabaseClient } from '@supabase/supabase-js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}))

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a valid future expires_at Unix timestamp (seconds).
 * Range: now + 1 second to now + 24 hours.
 */
const futureExpiresAt = fc.integer({
  min: Math.floor(Date.now() / 1000) + 1,
  max: Math.floor(Date.now() / 1000) + 86400,
})

/**
 * Generates a structurally valid Session object with arbitrary token values.
 */
const sessionArbitrary = fc.record({
  access_token: fc.string({ minLength: 10, maxLength: 200 }).filter(s => !s.includes('\0')),
  refresh_token: fc.string({ minLength: 10, maxLength: 200 }).filter(s => !s.includes('\0')),
  token_type: fc.constant('bearer'),
  expires_in: fc.integer({ min: 60, max: 86400 }),
  expires_at: futureExpiresAt,
  user: fc.record({
    id: fc.uuid(),
    email: fc.emailAddress(),
  }),
}) as fc.Arbitrary<Session>

/**
 * Generates a User object whose id matches the session user id.
 */
const userFromSession = (session: Session): User =>
  ({ id: session.user.id, email: session.user.email } as User)

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_KEY = 'supabase_session'

function makeSupabaseWithSession(session: Session, user: User): SupabaseClient {
  return {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session, user },
        error: null,
      }),
      signOut: jest.fn().mockResolvedValue({}),
      refreshSession: jest.fn(),
      getUser: jest.fn(),
    },
  } as unknown as SupabaseClient
}

// ── Property Tests ────────────────────────────────────────────────────────────

describe('AuthService – Property 12: Session Storage Round-Trip', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stores the exact session object in SecureStore on every successful sign-in', async () => {
    await fc.assert(
      fc.asyncProperty(sessionArbitrary, async (session) => {
        jest.clearAllMocks()

        const user = userFromSession(session)
        const supabase = makeSupabaseWithSession(session, user)
        const service = new AuthService(supabase)

        const result = await service.signIn(session.user.email!, 'any-password')

        // The sign-in must succeed
        expect(result.success).toBe(true)

        // SecureStore must have been called exactly once with the serialised session
        expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1)
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          SESSION_KEY,
          JSON.stringify(session),
        )
      }),
      { numRuns: 100 },
    )
  })

  it('stored session is retrievable and structurally equivalent to the original', async () => {
    await fc.assert(
      fc.asyncProperty(sessionArbitrary, async (session) => {
        jest.clearAllMocks()

        const user = userFromSession(session)
        const supabase = makeSupabaseWithSession(session, user)

        // Simulate SecureStore returning what was written
        ;(SecureStore.setItemAsync as jest.Mock).mockImplementation(
          async (_key: string, value: string) => {
            ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(value)
          },
        )

        const service = new AuthService(supabase)
        await service.signIn(session.user.email!, 'any-password')

        // Retrieve the session via getSession (mirrors real round-trip)
        const retrieved = await service.getSession()

        // Must be structurally equivalent to the original session
        expect(retrieved).toEqual(session)
      }),
      { numRuns: 100 },
    )
  })

  it('does NOT write to SecureStore when sign-in fails, for any session shape', async () => {
    await fc.assert(
      fc.asyncProperty(sessionArbitrary, async (session) => {
        jest.clearAllMocks()

        const supabase = {
          auth: {
            signInWithPassword: jest.fn().mockResolvedValue({
              data: { session: null, user: null },
              error: { message: 'Invalid credentials' },
            }),
          },
        } as unknown as SupabaseClient

        const service = new AuthService(supabase)
        const result = await service.signIn(session.user.email!, 'wrong-password')

        expect(result.success).toBe(false)
        expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
      }),
      { numRuns: 50 },
    )
  })
})

import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const FUTURE = Math.floor(Date.now() / 1000) + 3600  // 1 hour from now
const PAST   = Math.floor(Date.now() / 1000) - 3600  // 1 hour ago

function makeSession(expiresAt = FUTURE): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: 'user-1', email: 'test@example.com' } as User,
  } as Session
}

function makeUser(): User {
  return { id: 'user-1', email: 'test@example.com' } as User
}

function makeSupabase(overrides: Partial<{
  signInWithPassword: jest.Mock
  signOut: jest.Mock
  refreshSession: jest.Mock
  getUser: jest.Mock
}> = {}): SupabaseClient {
  return {
    auth: {
      signInWithPassword: overrides.signInWithPassword ?? jest.fn(),
      signOut: overrides.signOut ?? jest.fn().mockResolvedValue({}),
      refreshSession: overrides.refreshSession ?? jest.fn(),
      getUser: overrides.getUser ?? jest.fn(),
    },
  } as unknown as SupabaseClient
}

const SESSION_KEY = 'supabase_session'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── 1. Successful sign-in (Req 1.1) ────────────────────────────────────────

  describe('signIn – success', () => {
    it('stores the session in SecureStore and returns success result', async () => {
      const session = makeSession()
      const user = makeUser()
      const supabase = makeSupabase({
        signInWithPassword: jest.fn().mockResolvedValue({ data: { session, user }, error: null }),
      })
      const service = new AuthService(supabase)

      const result = await service.signIn('test@example.com', 'password123')

      expect(result).toEqual({ success: true, session, user })
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SESSION_KEY, JSON.stringify(session))
    })
  })

  // ── 2. Failed sign-in (Req 1.2) ────────────────────────────────────────────

  describe('signIn – failure', () => {
    it('does NOT write to SecureStore and returns error when supabase returns an error', async () => {
      const supabase = makeSupabase({
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: { message: 'Invalid credentials' },
        }),
      })
      const service = new AuthService(supabase)

      const result = await service.signIn('bad@example.com', 'wrong')

      expect(result).toEqual({ success: false, error: 'Invalid credentials' })
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
    })

    it('does NOT write to SecureStore and returns error when session is missing', async () => {
      const supabase = makeSupabase({
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: null,
        }),
      })
      const service = new AuthService(supabase)

      const result = await service.signIn('test@example.com', 'password123')

      expect(result).toEqual({ success: false, error: 'Sign in failed' })
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
    })
  })

  // ── 3. Sign-out (Req 1.3) ──────────────────────────────────────────────────

  describe('signOut', () => {
    it('calls supabase.auth.signOut and deletes the SecureStore entry', async () => {
      const signOut = jest.fn().mockResolvedValue({})
      const supabase = makeSupabase({ signOut })
      const service = new AuthService(supabase)

      await service.signOut()

      expect(signOut).toHaveBeenCalled()
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SESSION_KEY)
    })
  })

  // ── 4. Biometric path (Req 2.2) ────────────────────────────────────────────

  describe('authenticateWithBiometric', () => {
    it('retrieves stored session and does NOT call signInWithPassword on success', async () => {
      const session = makeSession()
      const user = makeUser()
      const signInWithPassword = jest.fn()
      const supabase = makeSupabase({
        signInWithPassword,
        getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      })
      const service = new AuthService(supabase)

      ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true })
      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(session))

      const result = await service.authenticateWithBiometric()

      expect(result).toEqual({ success: true, session, user })
      expect(signInWithPassword).not.toHaveBeenCalled()
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled()
    })

    it('returns failure when biometric prompt is rejected', async () => {
      const supabase = makeSupabase()
      const service = new AuthService(supabase)

      ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false })

      const result = await service.authenticateWithBiometric()

      expect(result).toEqual({ success: false, error: 'Biometric authentication failed' })
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled()
    })

    it('returns failure when no stored session exists after biometric success', async () => {
      const supabase = makeSupabase({
        refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: 'expired' } }),
      })
      const service = new AuthService(supabase)

      ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true })
      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)

      const result = await service.authenticateWithBiometric()

      expect(result).toEqual({ success: false, error: 'No stored session found. Please sign in with your password.' })
    })
  })

  // ── 5. Expired session (Req 2.5) ───────────────────────────────────────────

  describe('getSession – expired session', () => {
    it('clears SecureStore and returns null when session is expired and refresh fails', async () => {
      const expiredSession = makeSession(PAST)
      const supabase = makeSupabase({
        refreshSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: { message: 'Refresh token expired' },
        }),
      })
      const service = new AuthService(supabase)

      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(expiredSession))

      const result = await service.getSession()

      expect(result).toBeNull()
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SESSION_KEY)
    })

    it('returns refreshed session and updates SecureStore when refresh succeeds', async () => {
      const expiredSession = makeSession(PAST)
      const freshSession = makeSession(FUTURE)
      const supabase = makeSupabase({
        refreshSession: jest.fn().mockResolvedValue({
          data: { session: freshSession },
          error: null,
        }),
      })
      const service = new AuthService(supabase)

      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(expiredSession))

      const result = await service.getSession()

      expect(result).toEqual(freshSession)
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SESSION_KEY, JSON.stringify(freshSession))
    })

    it('returns valid session directly without calling refreshSession', async () => {
      const validSession = makeSession(FUTURE)
      const refreshSession = jest.fn()
      const supabase = makeSupabase({ refreshSession })
      const service = new AuthService(supabase)

      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(validSession))

      const result = await service.getSession()

      expect(result).toEqual(validSession)
      expect(refreshSession).not.toHaveBeenCalled()
    })
  })
})

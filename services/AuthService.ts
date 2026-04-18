import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import type { SupabaseClient, Session } from '@supabase/supabase-js'
import type { AuthResult } from '../types'
import { supabase } from '../lib/supabase'

const SESSION_KEY = 'supabase_session'
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'

// Safe wrappers — expo-secure-store native module may be unavailable on web
async function secureGet(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key) } catch { return null }
}
async function secureSet(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(key, value) } catch { /* no-op on web */ }
}
async function secureDel(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key) } catch { /* no-op on web */ }
}

export class AuthService {
  constructor(private supabase: SupabaseClient) {}

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.session || !data.user) {
        return { success: false, error: error?.message ?? 'Sign in failed' }
      }

      // Also persist to SecureStore for biometric unlock
      await secureSet(SESSION_KEY, JSON.stringify(data.session))

      return { success: true, session: data.session, user: data.user }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut()
    await secureDel(SESSION_KEY)
  }

  async getSession(): Promise<Session | null> {
    try {
      const raw = await secureGet(SESSION_KEY)
      if (!raw) return null

      const session: Session = JSON.parse(raw)

      if (this.isSessionValid(session)) {
        return session
      }

      // Session expired — attempt refresh
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      })

      if (error || !data.session) {
        await secureDel(SESSION_KEY)
        return null
      }

      await secureSet(SESSION_KEY, JSON.stringify(data.session))
      return data.session
    } catch {
      await secureDel(SESSION_KEY)
      return null
    }
  }

  async enableBiometric(): Promise<void> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const isEnrolled = await LocalAuthentication.isEnrolledAsync()

    if (hasHardware && isEnrolled) {
      await secureSet(BIOMETRIC_ENABLED_KEY, 'true')
    }
  }

  async authenticateWithBiometric(): Promise<AuthResult> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to continue',
        fallbackLabel: 'Use password',
      })

      if (!result.success) {
        return { success: false, error: 'Biometric authentication failed' }
      }

      // Biometric only unlocks the existing stored session — never issues a new one
      const session = await this.getSession()
      if (!session) {
        return { success: false, error: 'No stored session found. Please sign in with your password.' }
      }

      const { data: { user }, error } = await this.supabase.auth.getUser(session.access_token)
      if (error || !user) {
        return { success: false, error: 'Could not retrieve user from stored session' }
      }

      return { success: true, session, user }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Biometric error' }
    }
  }

  isSessionValid(session: Session): boolean {
    if (!session.expires_at) return false
    // expires_at is a Unix timestamp in seconds
    return session.expires_at > Math.floor(Date.now() / 1000)
  }
}

// Singleton instance for use in screens
export default new AuthService(supabase)

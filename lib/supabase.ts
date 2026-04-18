import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://szsicpnrbnhcxakpinqa.supabase.co'

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6c2ljcG5yYm5oY3hha3BpbnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjUxODgsImV4cCI6MjA5MTg0MTE4OH0.HFkPDsdXwvXL2wh9EcP5NitUQHq_04k3Vfa0uYuNk80'

function makeStorage() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      // SSR / static build — no-op storage
      return {
        getItem: (_key: string) => Promise.resolve(null),
        setItem: (_key: string, _value: string) => Promise.resolve(),
        removeItem: (_key: string) => Promise.resolve(),
      }
    }
    // Browser — use localStorage
    return {
      getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        window.localStorage.setItem(key, value)
        return Promise.resolve()
      },
      removeItem: (key: string) => {
        window.localStorage.removeItem(key)
        return Promise.resolve()
      },
    }
  }

  // Native — AsyncStorage (imported at top, not via require)
  return AsyncStorage
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: makeStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

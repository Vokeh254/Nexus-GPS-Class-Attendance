import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthGate(): { isAuthenticated: boolean; isLoading: boolean } {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let resolved = false;

    function resolve(authenticated: boolean) {
      if (resolved) return;
      resolved = true;
      setIsAuthenticated(authenticated);
      setIsLoading(false);
    }

    // onAuthStateChange fires INITIAL_SESSION on mount with the persisted session
    // This is the most reliable signal — works on both native and web
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        resolve(session !== null);
      } else {
        // Keep in sync after sign-in / sign-out
        setIsAuthenticated(session !== null);
      }
    });

    // Hard timeout: if INITIAL_SESSION never fires (e.g. storage error), unblock after 3s
    const timeout = setTimeout(() => resolve(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return { isAuthenticated, isLoading };
}

// ── Legacy component (kept for compatibility) ─────────────────────────────────

interface AppNavigatorProps {
  children: ReactNode;
}

export function AppNavigator({ children }: AppNavigatorProps) {
  return <>{children}</>;
}

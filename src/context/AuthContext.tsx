'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type AuthenticatedUser, getUser, signOut as signOutUser } from '@/lib/auth';
import { rewardsCall } from '@/lib/rewards';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides the current authenticated user (if any) to the rest of the app.
 * Wrap the root layout with this once; pages/components read it via useAuth().
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await getUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The server sends a new account's welcome email once; this only saves repeat calls from this browser
  useEffect(() => {
    if (!user?.id || !user.email) return;
    const key = `lyrtrip_welcomed_${user.id}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    rewardsCall<{ retry?: boolean }>({ action: 'welcome' })
      .then(r => { if (!r.retry) try { localStorage.setItem(key, '1'); } catch {} })
      .catch(() => {});
  }, [user?.id, user?.email]);

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, signOut }),
    [user, loading, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Read the current authenticated user. Must be used within <AuthProvider>.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}

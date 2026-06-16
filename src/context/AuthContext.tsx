'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type AuthenticatedUser, getUser, signOut as signOutUser } from '@/lib/auth';

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

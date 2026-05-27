import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID || 'dev-00000000-0000-0000-0000-000000000001';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

/** DEV mode: fake user that bypasses Supabase entirely */
const DEV_FAKE_USER = DEV_MODE
  ? ({ id: DEV_USER_ID, email: 'dev@andex.local', role: 'authenticated' } as unknown as User)
  : null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(DEV_MODE ? DEV_FAKE_USER : null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!DEV_MODE); // DEV: never loading

  useEffect(() => {
    if (DEV_MODE) return; // skip all Supabase calls in DEV mode

    // Hydrate initial session (avoids flash on page reload)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to future auth events (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

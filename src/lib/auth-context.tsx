import React, { createContext, useContext, useEffect, useState } from 'react';

// DEV_MODE skips real auth on the client. It is force-disabled in production
// builds so a stray VITE_DEV_MODE=true can never ship an unauthenticated app.
const DEV_MODE    = import.meta.env.VITE_DEV_MODE === 'true' && !import.meta.env.PROD;
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID || 'dev-00000000-0000-0000-0000-000000000001';

export interface AuthUser {
  id:        string;
  email:     string;
  firstName: string | null;
  lastName:  string | null;
}

interface AuthContextType {
  user:     AuthUser | null;
  loading:  boolean;
  login:    (email: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  acceptInvitation: (token: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user:     null,
  loading:  true,
  login:    async () => {},
  logout:   async () => {},
  register: async () => {},
  acceptInvitation: async () => {},
});

const DEV_USER: AuthUser = {
  id:        DEV_USER_ID,
  email:     'dev@andex.local',
  firstName: 'Dev',
  lastName:  'User',
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

// Only the short-lived access token lives in JS-readable storage. The refresh
// token is kept in an httpOnly cookie set by the server and is never exposed
// to JavaScript, so it cannot be stolen via XSS.
export const tokenStorage = {
  getAccess:   ()          => localStorage.getItem('access_token'),
  setAccess:   (a: string) => localStorage.setItem('access_token', a),
  clearTokens: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token'); // clean up any legacy token
  },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(DEV_MODE ? DEV_USER : null);
  const [loading, setLoading] = useState(!DEV_MODE);

  // On mount: restore session from localStorage
  useEffect(() => {
    if (DEV_MODE) return;

    const accessToken = tokenStorage.getAccess();
    if (!accessToken) { setLoading(false); return; }

    // Verify token by fetching /api/auth/me
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async res => {
        if (res.ok) {
          const { user: u } = await res.json() as { user: AuthUser };
          setUser(u);
        } else {
          // Access token rejected — try to refresh using the httpOnly cookie.
          const r2 = await fetch('/api/auth/refresh', {
            method:      'POST',
            credentials: 'include', // send the refresh cookie
          });
          if (r2.ok) {
            const { accessToken: newAccess } = await r2.json() as { accessToken: string };
            tokenStorage.setAccess(newAccess);
            const r3 = await fetch('/api/auth/me', {
              headers: { Authorization: `Bearer ${newAccess}` },
            });
            if (r3.ok) {
              const { user: u } = await r3.json() as { user: AuthUser };
              setUser(u);
            }
          } else {
            tokenStorage.clearTokens();
          }
        }
      })
      .catch(() => { tokenStorage.clearTokens(); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    if (DEV_MODE) return;
    const res = await fetch('/api/auth/login', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include', // receive the refresh cookie
      body:        JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    tokenStorage.setAccess(data.accessToken);
    setUser(data.user as AuthUser);
  };

  const logout = async (): Promise<void> => {
    if (DEV_MODE) return;
    await fetch('/api/auth/logout', {
      method:      'POST',
      credentials: 'include', // send the refresh cookie so the server can revoke it
    }).catch(() => {});
    tokenStorage.clearTokens();
    setUser(null);
  };

  const register = async (
    email: string, password: string, firstName?: string, lastName?: string,
  ): Promise<void> => {
    if (DEV_MODE) return;
    const res = await fetch('/api/auth/register', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ email, password, firstName, lastName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrarse');
    tokenStorage.setAccess(data.accessToken);
    setUser(data.user as AuthUser);
  };

  const acceptInvitation = async (
    token: string, password: string, firstName?: string, lastName?: string,
  ): Promise<void> => {
    const res = await fetch('/api/auth/accept-invitation', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ token, password, firstName, lastName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al aceptar la invitación');
    tokenStorage.setAccess(data.accessToken);
    setUser(data.user as AuthUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, acceptInvitation }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

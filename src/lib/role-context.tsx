import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';

interface MeResponse {
  userId: string;
  tenantId: string;
  role: string;
}

interface RoleContextType {
  role: string | null;
  tenantId: string | null;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  tenantId: null,
  loading: true,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [role, setRole]       = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setTenantId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get<MeResponse>('/api/me')
      .then(me => { setRole(me.role); setTenantId(me.tenantId); })
      .catch(() => { setRole(null); setTenantId(null); })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <RoleContext.Provider value={{ role, tenantId, loading }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);

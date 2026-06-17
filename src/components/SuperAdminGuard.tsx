import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '../lib/role-context';
import { Award } from 'lucide-react';

/**
 * Protects all /superadmin/* routes.
 * Renders a spinner while the role is being fetched, then redirects to /
 * if the resolved role is not 'superadmin'.
 */
export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { role, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/30">
          <Award className="h-6 w-6 text-white" />
        </div>
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

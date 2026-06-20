import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Building2, Users, TrendingUp, ShieldCheck, Award,
  Plus, ArrowRight, Activity, LayoutDashboard, LogOut, ChevronRight,
  Sun, Moon, Settings, BarChart3,
} from 'lucide-react';
import logoLight from '../assets/logo-light.png';
import logoDark  from '../assets/logo-dark.png';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { format } from 'date-fns';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  rut: string;
  plan: 'starter' | 'pro' | 'business' | 'suspended';
  active: boolean;
  createdBy: string;
  createdAt: string;
  planExpiry: string | null;
  subdomain: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
  domainVerifyToken: string | null;
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

export const PLAN_META: Record<
  Tenant['plan'],
  { label: string; className: string }
> = {
  starter:   { label: 'Starter',   className: 'bg-slate-700 text-slate-300' },
  pro:       { label: 'Pro',        className: 'bg-brand/20 text-brand' },
  business:  { label: 'Business',   className: 'bg-purple-500/20 text-purple-400' },
  suspended: { label: 'Suspendido', className: 'bg-red-500/20 text-red-400' },
};

export function PlanBadge({ plan }: { plan: Tenant['plan'] }) {
  const m = PLAN_META[plan] ?? PLAN_META.starter;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest', m.className)}>
      {m.label}
    </span>
  );
}

// ─── Shared admin layout ──────────────────────────────────────────────────────

export function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-950 light:bg-slate-50 font-sans transition-colors duration-200">

      {/* Top navigation bar */}
      <header className="bg-slate-900 light:bg-white border-b border-white/5 light:border-slate-200 sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <img src={logoDark}  alt="AndeXCertify" className="h-[87px] w-auto block light:hidden" />
            <img src={logoLight} alt="AndeXCertify" className="h-[87px] w-auto hidden light:block" />
            <div className="flex items-center gap-1.5 border-l border-white/10 light:border-slate-200 pl-3">
              <ShieldCheck className="h-3 w-3 text-amber-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">Superadmin</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            <NavLink
              to="/superadmin"
              end
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                isActive
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:bg-white/5 light:hover:bg-slate-100'
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </NavLink>
            <NavLink
              to="/superadmin/tenants"
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                isActive
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:bg-white/5 light:hover:bg-slate-100'
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              OTECs
            </NavLink>
            <NavLink
              to="/superadmin/tenants/new"
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                isActive
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:bg-white/5 light:hover:bg-slate-100'
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo OTEC
            </NavLink>
            <NavLink
              to="/superadmin/metrics"
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                isActive
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:bg-white/5 light:hover:bg-slate-100'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Métricas
            </NavLink>
            <NavLink
              to="/superadmin/settings"
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                isActive
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:bg-white/5 light:hover:bg-slate-100'
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              Config
            </NavLink>
          </nav>

          {/* Right: theme toggle + back to app + logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-brand hover:bg-white/5 light:hover:bg-slate-100 transition-all"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />
              }
            </button>

            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 light:border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:border-white/20 light:hover:border-slate-400 transition-all"
            >
              <ArrowRight className="h-3 w-3 rotate-180" />
              Volver a App
            </button>
            <button
              onClick={() => logout()}
              className="h-8 w-8 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Page heading */}
      <div className="border-b border-white/5 light:border-slate-200 bg-slate-900/50 light:bg-white/80 transition-colors duration-200">
        <div className="max-w-screen-xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-black text-white light:text-slate-900 tracking-tight">{title}</h1>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-screen-xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'brand',
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color?: 'brand' | 'green' | 'red' | 'purple' | 'amber';
}) {
  const colorMap = {
    brand:  'text-brand bg-brand/10',
    green:  'text-emerald-400 bg-emerald-500/10',
    red:    'text-red-400 bg-red-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    amber:  'text-amber-400 bg-amber-500/10',
  };
  return (
    <div className="bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl p-6 flex flex-col gap-4 transition-colors duration-200">
      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', colorMap[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-3xl font-black text-white light:text-slate-900 leading-none">{value}</div>
        {sub && <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{sub}</div>}
      </div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export function SuperAdmin() {
  const [tenants, setTenants]   = useState<Tenant[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  useEffect(() => {
    api.get<Tenant[]>('/api/admin/tenants')
      .then(setTenants)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total      = tenants.length;
  const active     = tenants.filter(t => t.active).length;
  const suspended  = tenants.filter(t => !t.active).length;
  const byPlan     = {
    starter:  tenants.filter(t => t.plan === 'starter').length,
    pro:      tenants.filter(t => t.plan === 'pro').length,
    business: tenants.filter(t => t.plan === 'business').length,
  };
  const recent = [...tenants]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <AdminLayout title="Panel de Control">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Cargando datos...</span>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-5 text-red-400 text-sm font-bold">
          Error: {error}
        </div>
      ) : (
        <div className="space-y-10">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard icon={Building2}   label="Total OTECs"    value={total}           color="brand"  />
            <StatCard icon={Activity}    label="Activos"        value={active}          color="green"  />
            <StatCard icon={ShieldCheck} label="Inactivos"      value={suspended}       color="red"    />
            <StatCard icon={TrendingUp}  label="Plan Pro"       value={byPlan.pro}      sub="orgs"     color="brand"  />
            <StatCard icon={Award}       label="Plan Business"  value={byPlan.business} sub="orgs"     color="purple" />
          </div>

          {/* ── Plan distribution bar ── */}
          {total > 0 && (
            <div className="bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl p-6 transition-colors duration-200">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-5">
                Distribución de planes
              </p>
              <div className="flex rounded-full overflow-hidden h-4 gap-px">
                {byPlan.starter  > 0 && <div style={{ width: `${byPlan.starter  / total * 100}%` }} className="bg-slate-600 transition-all" title={`Starter: ${byPlan.starter}`} />}
                {byPlan.pro      > 0 && <div style={{ width: `${byPlan.pro      / total * 100}%` }} className="bg-brand transition-all"       title={`Pro: ${byPlan.pro}`} />}
                {byPlan.business > 0 && <div style={{ width: `${byPlan.business / total * 100}%` }} className="bg-purple-500 transition-all"  title={`Business: ${byPlan.business}`} />}
              </div>
              <div className="flex items-center gap-6 mt-4">
                {[
                  { label: 'Starter',  n: byPlan.starter,  dot: 'bg-slate-600' },
                  { label: 'Pro',      n: byPlan.pro,       dot: 'bg-brand' },
                  { label: 'Business', n: byPlan.business,  dot: 'bg-purple-500' },
                ].map(({ label, n, dot }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', dot)} />
                    <span className="text-[10px] font-bold text-slate-400 light:text-slate-600">{label} <span className="text-white light:text-slate-900">{n}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent OTECs ── */}
          <div className="bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl overflow-hidden transition-colors duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 light:border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">OTECs recientes</p>
              <Link
                to="/superadmin/tenants"
                className="flex items-center gap-1 text-[10px] font-bold text-brand hover:text-white transition-colors uppercase tracking-widest"
              >
                Ver todos <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-500 text-sm">
                No hay OTECs registrados todavía.{' '}
                <Link to="/superadmin/tenants/new" className="text-brand hover:underline">Crear el primero</Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5 light:divide-slate-100">
                {recent.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] light:hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-9 w-9 rounded-xl bg-slate-800 light:bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-black text-slate-300 light:text-slate-600 uppercase">
                          {t.name.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white light:text-slate-900 leading-none">{t.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{t.rut}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <PlanBadge plan={t.plan} />
                      {!t.active && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">
                          Inactivo
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600 font-mono hidden md:block">
                        {format(new Date(t.createdAt), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Quick action ── */}
          <Link
            to="/superadmin/tenants/new"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed border-white/10 light:border-slate-300 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-brand hover:border-brand/40 transition-all group"
          >
            <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
            Registrar nuevo OTEC
          </Link>
        </div>
      )}
    </AdminLayout>
  );
}

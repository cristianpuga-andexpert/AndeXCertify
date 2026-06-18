import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Plus, Search, Users, Calendar, ToggleLeft, ToggleRight,
  Edit2, Trash2, X, Check, ChevronDown, AlertTriangle, Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { AdminLayout, Tenant, PlanBadge, PLAN_META } from './SuperAdmin';
import { DomainModal } from '../components/DomainModal';

// ─── Edit-plan modal ──────────────────────────────────────────────────────────

function EditPlanModal({
  tenant, onClose, onSaved,
}: {
  tenant: Tenant;
  onClose: () => void;
  onSaved: (updated: Tenant) => void;
}) {
  const plans: Tenant['plan'][] = ['starter', 'pro', 'business', 'suspended'];
  const [plan, setPlan]     = useState<Tenant['plan']>(tenant.plan);
  const [expiry, setExpiry] = useState(
    tenant.planExpiry ? new Date(tenant.planExpiry).toISOString().split('T')[0] : ''
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const updated = await api.put<Tenant>(`/api/admin/tenants/${tenant.id}`, {
        plan, planExpiry: expiry || null,
      });
      onSaved(updated);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-slate-900 light:bg-white border border-white/10 light:border-slate-200 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 light:border-slate-100">
          <div>
            <h2 className="text-sm font-black text-white light:text-slate-900">Cambiar Plan</h2>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white light:hover:text-slate-900 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {plans.map(p => {
                const m = PLAN_META[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 rounded-xl border text-left transition-all',
                      plan === p
                        ? 'border-brand bg-brand/10'
                        : 'border-white/10 light:border-slate-200 bg-slate-800 light:bg-slate-50 hover:border-white/20 light:hover:border-slate-300'
                    )}
                  >
                    {plan === p && <Check className="h-3 w-3 text-brand shrink-0" />}
                    <span className={cn('text-[11px] font-black uppercase tracking-widest', m.className.split(' ')[1])}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
              Vencimiento del plan{' '}
              <span className="text-slate-600 normal-case tracking-normal font-normal">(opcional)</span>
            </label>
            <input
              type="date"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 light:bg-slate-50 border border-white/10 light:border-slate-200 rounded-xl text-white light:text-slate-900 text-sm font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
            />
          </div>

          {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({
  tenant, onClose, onConfirmed,
}: {
  tenant: Tenant;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try {
      await api.del(`/api/admin/tenants/${tenant.id}`);
      onConfirmed();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-slate-900 light:bg-white border border-white/10 light:border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-base font-black text-white light:text-slate-900 mb-1">Eliminar OTEC</h2>
          <p className="text-sm text-slate-400 light:text-slate-600 leading-relaxed">
            ¿Desactivar <span className="text-white light:text-slate-900 font-bold">{tenant.name}</span>?
            Los datos se conservan pero el acceso será bloqueado.
          </p>
          {error && <p className="text-red-400 text-xs font-bold mt-3">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bg-red-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-600 transition-all uppercase text-[10px] tracking-[0.15em] flex items-center justify-center disabled:opacity-60"
          >
            {loading ? 'Eliminando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant row ───────────────────────────────────────────────────────────────

function TenantRow({
  tenant, userCount, onEditPlan, onManageDomains, onToggleActive, onDelete, toggling,
}: {
  tenant: Tenant;
  userCount: number;
  onEditPlan: () => void;
  onManageDomains: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  toggling: boolean;
}) {
  return (
    <div className="grid grid-cols-12 items-center px-6 py-5 hover:bg-white/[0.02] light:hover:bg-slate-50 transition-colors gap-4 group">

      {/* Name + RUT */}
      <div className="col-span-4 flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-slate-800 light:bg-slate-100 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-black text-slate-300 light:text-slate-600 uppercase">
            {tenant.name.slice(0, 2)}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white light:text-slate-900 truncate leading-none">{tenant.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500 font-mono">{tenant.rut}</span>
            {(tenant.customDomain && tenant.customDomainVerified) ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400 truncate">
                <Globe className="h-2.5 w-2.5 shrink-0" />{tenant.customDomain}
              </span>
            ) : tenant.subdomain ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 truncate">
                <Globe className="h-2.5 w-2.5 shrink-0" />{tenant.subdomain}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="col-span-2">
        <PlanBadge plan={tenant.plan} />
        {tenant.planExpiry && (
          <div className="text-[9px] text-slate-600 font-mono mt-1">
            Vence {format(new Date(tenant.planExpiry), 'dd/MM/yy')}
          </div>
        )}
      </div>

      {/* Status toggle */}
      <div className="col-span-2 flex items-center gap-2">
        <button
          onClick={onToggleActive}
          disabled={toggling}
          className={cn(
            'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50',
            tenant.active ? 'text-emerald-400 hover:text-white light:hover:text-slate-900' : 'text-red-400 hover:text-white light:hover:text-slate-900'
          )}
          title={tenant.active ? 'Suspender' : 'Activar'}
        >
          {tenant.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {tenant.active ? 'Activo' : 'Inactivo'}
        </button>
      </div>

      {/* Users */}
      <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-slate-500">
        <Users className="h-3.5 w-3.5 shrink-0" />
        <span className="font-bold text-slate-300 light:text-slate-700">{userCount}</span>
        <span>usuarios</span>
      </div>

      {/* Date + actions */}
      <div className="col-span-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] text-slate-600 font-mono">
          <Calendar className="h-3 w-3 shrink-0" />
          {format(new Date(tenant.createdAt), 'dd/MM/yy')}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onManageDomains}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-brand hover:bg-brand/10 transition-all"
            title="Dominios"
          >
            <Globe className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onEditPlan}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-brand hover:bg-brand/10 transition-all"
            title="Editar plan"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SuperAdminTenants() {
  const [tenants,    setTenants]    = useState<Tenant[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [planFilter, setPlanFilter] = useState<Tenant['plan'] | 'all'>('all');
  const [editTarget,   setEditTarget]   = useState<Tenant | null>(null);
  const [domainTarget, setDomainTarget] = useState<Tenant | null>(null);
  const [delTarget,    setDelTarget]    = useState<Tenant | null>(null);
  const [toggling,   setToggling]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Tenant[]>('/api/admin/tenants'),
      api.get<Record<string, number>>('/api/admin/tenant-user-counts'),
    ])
      .then(([list, counts]) => { setTenants(list); setUserCounts(counts); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => tenants.filter(t => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) || t.rut.includes(search);
    const matchPlan = planFilter === 'all' || t.plan === planFilter;
    return matchSearch && matchPlan;
  }), [tenants, search, planFilter]);

  const handleToggleActive = async (tenant: Tenant) => {
    setToggling(tenant.id);
    try {
      const updated = await api.put<Tenant>(`/api/admin/tenants/${tenant.id}`, { active: !tenant.active });
      setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setToggling(null); }
  };

  const handlePlanSaved = (updated: Tenant) => {
    setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
    setEditTarget(null);
  };

  const handleDeleted = () => {
    if (!delTarget) return;
    setTenants(prev => prev.map(t => t.id === delTarget.id ? { ...t, active: false } : t));
    setDelTarget(null);
  };

  const planOptions: { value: Tenant['plan'] | 'all'; label: string }[] = [
    { value: 'all',       label: 'Todos los planes' },
    { value: 'starter',   label: 'Starter' },
    { value: 'pro',       label: 'Pro' },
    { value: 'business',  label: 'Business' },
    { value: 'suspended', label: 'Suspendido' },
  ];

  return (
    <AdminLayout title="Gestión de OTECs">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre o RUT…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-900 light:bg-white border border-white/10 light:border-slate-200 rounded-xl text-white light:text-slate-900 text-sm font-medium placeholder-slate-600 light:placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all shadow-sm"
          />
        </div>

        <div className="relative">
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value as typeof planFilter)}
            className="appearance-none pl-4 pr-9 py-3 bg-slate-900 light:bg-white border border-white/10 light:border-slate-200 rounded-xl text-white light:text-slate-700 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:border-brand transition-all cursor-pointer shadow-sm"
          >
            {planOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        </div>

        <Link to="/superadmin/tenants/new" className="btn-primary gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nuevo OTEC
        </Link>
      </div>

      {/* Table */}
      <div className="bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl overflow-hidden transition-colors duration-200">

        {/* Column headers */}
        <div className="grid grid-cols-12 items-center px-6 py-3 border-b border-white/5 light:border-slate-100 gap-4">
          {[
            { label: 'Organización', cols: 'col-span-4' },
            { label: 'Plan',         cols: 'col-span-2' },
            { label: 'Estado',       cols: 'col-span-2' },
            { label: 'Usuarios',     cols: 'col-span-2' },
            { label: 'Creado',       cols: 'col-span-2' },
          ].map(({ label, cols }) => (
            <div key={label} className={cn('text-[9px] font-black uppercase tracking-[0.2em] text-slate-600', cols)}>
              {label}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-brand border-t-transparent" />
            <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Cargando…</span>
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-red-400 text-sm font-bold text-center">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Building2 className="h-12 w-12 text-slate-700 light:text-slate-300" />
            <p className="text-slate-500 text-sm">
              {search || planFilter !== 'all'
                ? 'Sin resultados para los filtros aplicados.'
                : 'No hay OTECs registrados todavía.'}
            </p>
            {!search && planFilter === 'all' && (
              <Link to="/superadmin/tenants/new" className="btn-primary mt-2">Crear primer OTEC</Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5 light:divide-slate-100">
            {filtered.map(t => (
              <TenantRow
                key={t.id}
                tenant={t}
                userCount={userCounts[t.id] ?? 0}
                onEditPlan={() => setEditTarget(t)}
                onManageDomains={() => setDomainTarget(t)}
                onToggleActive={() => handleToggleActive(t)}
                onDelete={() => setDelTarget(t)}
                toggling={toggling === t.id}
              />
            ))}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/5 light:border-slate-100 text-[10px] text-slate-600 font-bold">
            {filtered.length} de {tenants.length} OTECs
          </div>
        )}
      </div>

      {editTarget && (
        <EditPlanModal tenant={editTarget} onClose={() => setEditTarget(null)} onSaved={handlePlanSaved} />
      )}
      {domainTarget && (
        <DomainModal
          tenant={domainTarget}
          onClose={() => setDomainTarget(null)}
          onSaved={(updated) => {
            setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
            setDomainTarget(updated);
          }}
        />
      )}
      {delTarget && (
        <DeleteModal tenant={delTarget} onClose={() => setDelTarget(null)} onConfirmed={handleDeleted} />
      )}
    </AdminLayout>
  );
}

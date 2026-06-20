import React, { useEffect, useState } from 'react';
import { Cpu, MemoryStick, HardDrive, Clock, Building2, Users, BookOpen, GraduationCap, Award, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { AdminLayout, PlanBadge, Tenant } from './SuperAdmin';

interface Metrics {
  system: {
    loadavg: number[];
    cpuCount: number;
    memTotal: number;
    memFree: number;
    diskTotal: number;
    diskFree: number;
    hostUptime: number;
    appUptime: number;
  };
  totals: { tenants: number; users: number; courses: number; enrollments: number; certificates: number };
  tenants: Array<{
    id: string; name: string; plan: Tenant['plan']; active: boolean;
    users: number; courses: number; enrollments: number; certificates: number;
  }>;
}

const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
const pct = (used: number, total: number) => (total > 0 ? Math.round((used / total) * 100) : 0);
function uptimeStr(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Health bar with color thresholds (green < 70%, amber < 90%, red otherwise)
function HealthCard({ icon: Icon, label, value, sub, percent }: {
  icon: React.ElementType; label: string; value: string; sub?: string; percent?: number;
}) {
  const color = percent === undefined ? 'brand'
    : percent < 70 ? 'green' : percent < 90 ? 'amber' : 'red';
  const colorMap: Record<string, string> = {
    brand: 'text-brand bg-brand/10', green: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10', red: 'text-red-400 bg-red-500/10',
  };
  const barMap: Record<string, string> = { green: 'bg-emerald-400', amber: 'bg-amber-400', red: 'bg-red-400', brand: 'bg-brand' };
  return (
    <div className="bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl p-5 flex flex-col gap-3 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', colorMap[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        {percent !== undefined && <span className="text-[11px] font-black text-slate-400">{percent}%</span>}
      </div>
      <div>
        <div className="text-2xl font-black text-white light:text-slate-900 leading-none">{value}</div>
        {sub && <div className="text-[10px] font-bold text-slate-500 mt-1">{sub}</div>}
      </div>
      {percent !== undefined && (
        <div className="h-1.5 rounded-full bg-slate-800 light:bg-slate-200 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', barMap[color])} style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
      )}
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
    </div>
  );
}

export function SuperAdminMetrics() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get<Metrics>('/api/admin/metrics')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <AdminLayout title="Métricas y Rendimiento">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Cargando métricas…</span>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-5 text-red-400 text-sm font-bold">Error: {error}</div>
      ) : data && (
        <div className="space-y-10">

          {/* ── Server health ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Salud del servidor</p>
              <button onClick={load} className="flex items-center gap-1.5 text-[10px] font-bold text-brand hover:text-white transition-colors uppercase tracking-widest">
                <RefreshCw className="h-3 w-3" /> Actualizar
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <HealthCard
                icon={Cpu} label="CPU (carga 1 min)"
                value={data.system.loadavg[0].toFixed(2)}
                sub={`${data.system.cpuCount} vCPU`}
                percent={pct(data.system.loadavg[0], data.system.cpuCount)}
              />
              <HealthCard
                icon={MemoryStick} label="Memoria"
                value={`${gb(data.system.memTotal - data.system.memFree)} / ${gb(data.system.memTotal)} GB`}
                percent={pct(data.system.memTotal - data.system.memFree, data.system.memTotal)}
              />
              <HealthCard
                icon={HardDrive} label="Disco"
                value={`${gb(data.system.diskTotal - data.system.diskFree)} / ${gb(data.system.diskTotal)} GB`}
                percent={pct(data.system.diskTotal - data.system.diskFree, data.system.diskTotal)}
              />
              <HealthCard
                icon={Clock} label="Uptime"
                value={uptimeStr(data.system.appUptime)}
                sub={`Servidor: ${uptimeStr(data.system.hostUptime)}`}
              />
            </div>
          </section>

          {/* ── Global totals ── */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Totales de la plataforma</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { icon: Building2, label: 'OTECs', value: data.totals.tenants },
                { icon: Users, label: 'Usuarios', value: data.totals.users },
                { icon: BookOpen, label: 'Cursos', value: data.totals.courses },
                { icon: GraduationCap, label: 'Alumnos', value: data.totals.enrollments },
                { icon: Award, label: 'Certificados', value: data.totals.certificates },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl p-5 flex flex-col gap-3">
                  <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center"><Icon className="h-4.5 w-4.5" /></div>
                  <div className="text-2xl font-black text-white light:text-slate-900 leading-none">{value}</div>
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Per-tenant table ── */}
          <section className="bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 light:border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Uso por OTEC</p>
            </div>
            <div className="grid grid-cols-12 items-center px-6 py-3 border-b border-white/5 light:border-slate-100 gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
              <div className="col-span-4">Organización</div>
              <div className="col-span-2">Plan</div>
              <div className="col-span-1 text-right">Usuarios</div>
              <div className="col-span-2 text-right">Cursos</div>
              <div className="col-span-1 text-right">Alumnos</div>
              <div className="col-span-2 text-right">Certificados</div>
            </div>
            {data.tenants.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-500 text-sm">No hay OTECs registrados.</div>
            ) : (
              <div className="divide-y divide-white/5 light:divide-slate-100">
                {data.tenants.map(t => (
                  <div key={t.id} className="grid grid-cols-12 items-center px-6 py-4 hover:bg-white/[0.02] light:hover:bg-slate-50 transition-colors gap-4">
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-white light:text-slate-900 truncate">{t.name}</span>
                      {!t.active && <span className="text-[8px] font-black uppercase text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Inactivo</span>}
                    </div>
                    <div className="col-span-2"><PlanBadge plan={t.plan} /></div>
                    <div className="col-span-1 text-right text-sm font-bold text-slate-300 light:text-slate-700">{t.users}</div>
                    <div className="col-span-2 text-right text-sm font-bold text-slate-300 light:text-slate-700">{t.courses}</div>
                    <div className="col-span-1 text-right text-sm font-bold text-slate-300 light:text-slate-700">{t.enrollments}</div>
                    <div className="col-span-2 text-right text-sm font-bold text-brand">{t.certificates}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

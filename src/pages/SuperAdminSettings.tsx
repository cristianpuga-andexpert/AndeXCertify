import React, { useEffect, useState } from 'react';
import { Globe, CreditCard, Check, Info } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { AdminLayout } from './SuperAdmin';

interface PlatformSettings {
  publicRegistrationEnabled: boolean;
  defaultSignupPlan:         'starter' | 'pro' | 'business';
  signupBillingCycle:        string;
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative h-7 w-12 rounded-full transition-colors shrink-0 disabled:opacity-50',
        on ? 'bg-brand' : 'bg-slate-600 light:bg-slate-300'
      )}
    >
      <span className={cn(
        'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
        on ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  );
}

export function SuperAdminSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    api.get<PlatformSettings>('/api/admin/platform-settings')
      .then(setSettings)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const patch = async (changes: Partial<PlatformSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...changes };
    setSettings(next);
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.put<PlatformSettings>('/api/admin/platform-settings', changes);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Configuración de la plataforma">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
        </div>
      ) : !settings ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-5 text-red-400 text-sm font-bold">
          {error || 'No se pudo cargar la configuración.'}
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">

          {saved && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <Check className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Cambios guardados</span>
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm font-bold">{error}</div>
          )}

          {/* Public registration */}
          <div className="bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl p-6 transition-colors duration-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white light:text-slate-900">Registro público</h3>
                  <p className="text-[13px] text-slate-400 light:text-slate-500 mt-1 leading-relaxed max-w-md">
                    Si está <strong>activo</strong>, cualquier OTEC puede crear su propia cuenta desde la
                    página de inicio. Si está <strong>inactivo</strong>, solo tú puedes dar de alta nuevas
                    OTEC mediante invitación.
                  </p>
                </div>
              </div>
              <Toggle
                on={settings.publicRegistrationEnabled}
                disabled={saving}
                onChange={() => patch({ publicRegistrationEnabled: !settings.publicRegistrationEnabled })}
              />
            </div>
          </div>

          {/* Self-signup plan (only relevant when public registration is on) */}
          <div className={cn(
            'bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl p-6 transition-all duration-200',
            !settings.publicRegistrationEnabled && 'opacity-50 pointer-events-none'
          )}>
            <div className="flex items-start gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white light:text-slate-900">Plan y facturación del auto-registro</h3>
                <p className="text-[13px] text-slate-400 light:text-slate-500 mt-1 leading-relaxed max-w-md">
                  Plan y ciclo de cobro que se asignará a las OTEC que se registren solas.
                  <span className="inline-flex items-center gap-1 mt-1 text-amber-400 text-[11px] font-bold">
                    <Info className="h-3 w-3" /> El cobro automático se conectará en una fase futura.
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 ml-13">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Plan inicial</label>
                <select
                  value={settings.defaultSignupPlan}
                  onChange={e => patch({ defaultSignupPlan: e.target.value as PlatformSettings['defaultSignupPlan'] })}
                  className="w-full px-4 py-2.5 bg-slate-800 light:bg-slate-50 border border-white/10 light:border-slate-200 rounded-xl text-white light:text-slate-900 text-sm font-bold focus:outline-none focus:border-brand"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Ciclo de cobro</label>
                <select
                  value={settings.signupBillingCycle}
                  onChange={e => patch({ signupBillingCycle: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-800 light:bg-slate-50 border border-white/10 light:border-slate-200 rounded-xl text-white light:text-slate-900 text-sm font-bold focus:outline-none focus:border-brand"
                >
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

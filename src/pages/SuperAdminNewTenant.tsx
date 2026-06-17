import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Hash, Check, ChevronLeft, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { AdminLayout, Tenant, PLAN_META } from './SuperAdmin';

// ─── Plan selection card ──────────────────────────────────────────────────────

function PlanCard({
  plan, selected, onClick,
}: {
  plan: Tenant['plan'];
  selected: boolean;
  onClick: () => void;
}) {
  const m = PLAN_META[plan];

  const features: Record<Tenant['plan'], string[]> = {
    starter:   ['Hasta 2 usuarios', 'Hasta 50 certificados/mes', 'Plantillas básicas'],
    pro:       ['Hasta 10 usuarios', 'Certificados ilimitados',   'Todas las plantillas', 'Soporte prioritario'],
    business:  ['Usuarios ilimitados', 'Certificados ilimitados', 'API access', 'SLA garantizado'],
    suspended: ['Acceso bloqueado', 'Solo lectura'],
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col gap-3 p-5 rounded-2xl border-2 text-left transition-all',
        selected
          ? 'border-brand bg-brand/5 shadow-lg shadow-brand/10'
          : 'border-white/10 light:border-slate-200 bg-slate-800 light:bg-slate-50 hover:border-white/20 light:hover:border-slate-300'
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-brand flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
      <span className={cn('text-[10px] font-black uppercase tracking-widest', m.className.split(' ')[1])}>
        {m.label}
      </span>
      <ul className="space-y-1.5">
        {features[plan].map(f => (
          <li key={f} className="flex items-center gap-2 text-[11px] text-slate-400 light:text-slate-500">
            <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', selected ? 'bg-brand' : 'bg-slate-600 light:bg-slate-300')} />
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label, hint, icon: Icon, error, children,
}: {
  label: string;
  hint?: string;
  icon?: React.ElementType;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 light:text-slate-500 flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3" />}
          {label}
        </label>
        {hint && <span className="text-[9px] text-slate-600 light:text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-red-400 text-[11px] font-bold">{error}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  rut: string;
  plan: Tenant['plan'];
  adminEmail: string;
  planExpiry: string;
}

const INITIAL: FormState = {
  name: '', rut: '', plan: 'starter',
  adminEmail: '', planExpiry: '',
};

export function SuperAdminNewTenant() {
  const navigate = useNavigate();
  const [form,        setForm]        = useState<FormState>(INITIAL);
  const [errors,      setErrors]      = useState<Partial<FormState>>({});
  const [submitting,  setSubmitting]  = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [success,     setSuccess]     = useState(false);
  const [inviteLink,  setInviteLink]  = useState<string | null>(null);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.name.trim())       errs.name       = 'Requerido';
    if (!form.rut.trim())        errs.rut        = 'Requerido';
    if (!form.adminEmail.trim()) errs.adminEmail = 'Requerido';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true); setGlobalError('');
    try {
      const res = await api.post<{ emailSent: boolean; inviteLink?: string }>('/api/admin/tenants', {
        name:       form.name.trim(),
        rut:        form.rut.trim(),
        adminEmail: form.adminEmail.trim(),
        plan:       form.plan === 'suspended' ? 'starter' : form.plan,
        planExpiry: form.planExpiry || null,
      });
      setInviteLink(res.inviteLink ?? null);
      setSuccess(true);
      // If the email was sent, auto-redirect. Otherwise keep the page so the
      // superadmin can copy the invitation link manually.
      if (res.emailSent) setTimeout(() => navigate('/superadmin/tenants'), 2200);
    } catch (err: any) {
      setGlobalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <AdminLayout title="Nuevo OTEC">
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center max-w-lg mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white light:text-slate-900">OTEC registrado</h2>
            <p className="text-slate-400 light:text-slate-500 text-sm mt-1">
              {inviteLink
                ? 'No se pudo enviar el correo (SMTP no configurado). Comparte este enlace con el administrador para que active su cuenta:'
                : `Se envió una invitación a ${form.adminEmail} para que active su cuenta.`}
            </p>
          </div>
          {inviteLink && (
            <div className="w-full bg-slate-800 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                onFocus={e => e.currentTarget.select()}
                className="flex-1 bg-transparent text-[11px] font-mono text-brand outline-none truncate"
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white light:hover:text-slate-900"
              >
                Copiar
              </button>
            </div>
          )}
          <button onClick={() => navigate('/superadmin/tenants')} className="btn-primary mt-2">
            Ir a la lista de OTECs
          </button>
        </div>
      </AdminLayout>
    );
  }

  // Input class shared across fields
  const inputCls = 'w-full px-4 py-3 bg-slate-800 light:bg-slate-50 border border-white/10 light:border-slate-200 rounded-xl text-white light:text-slate-900 text-sm font-medium placeholder-slate-600 light:placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all';
  const sectionCls = 'bg-slate-900 light:bg-white border border-white/5 light:border-slate-200 light:shadow-sm rounded-2xl p-6 space-y-5 transition-colors duration-200';
  const sectionLabelCls = 'text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2';

  return (
    <AdminLayout title="Registrar nuevo OTEC">
      <div className="max-w-2xl">

        <button
          onClick={() => navigate('/superadmin/tenants')}
          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-white light:hover:text-slate-900 uppercase tracking-widest mb-8 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Volver a OTECs
        </button>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Datos del OTEC ── */}
          <div className={sectionCls}>
            <p className={sectionLabelCls}>
              <Building2 className="h-3.5 w-3.5" />
              Datos del OTEC
            </p>

            <Field label="Nombre de la organización" icon={Building2} error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Ej: Capacitaciones del Norte S.A."
                className={inputCls}
              />
            </Field>

            <Field label="RUT" icon={Hash} hint="Sin puntos, con guion" error={errors.rut}>
              <input
                type="text"
                value={form.rut}
                onChange={set('rut')}
                placeholder="76.543.210-K"
                className={cn(inputCls, 'font-mono')}
              />
            </Field>
          </div>

          {/* ── Administrador ── */}
          <div className={sectionCls}>
            <p className={sectionLabelCls}>
              <Mail className="h-3.5 w-3.5" />
              Administrador inicial
            </p>

            <Field
              label="Email del administrador"
              icon={Mail}
              hint="Recibirá una invitación para definir su contraseña"
              error={errors.adminEmail}
            >
              <input
                type="email"
                value={form.adminEmail}
                onChange={set('adminEmail')}
                placeholder="admin@otec.cl"
                className={inputCls}
              />
            </Field>

            <div className="flex items-start gap-2 bg-brand/5 border border-brand/10 rounded-xl px-4 py-3">
              <Mail className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400 light:text-slate-500 leading-relaxed">
                No necesitas crear la cuenta ni la contraseña. Se enviará un correo de invitación
                al administrador para que active su cuenta y defina su clave.
              </p>
            </div>
          </div>

          {/* ── Plan ── */}
          <div className={sectionCls}>
            <p className={sectionLabelCls}>
              <Sparkles className="h-3.5 w-3.5" />
              Plan de suscripción
            </p>

            <div className="grid grid-cols-2 gap-3">
              {(['starter', 'pro', 'business'] as Tenant['plan'][]).map(p => (
                <PlanCard
                  key={p}
                  plan={p}
                  selected={form.plan === p}
                  onClick={() => setForm(prev => ({ ...prev, plan: p }))}
                />
              ))}
            </div>

            <Field label="Fecha de vencimiento" hint="Opcional">
              <input
                type="date"
                value={form.planExpiry}
                onChange={set('planExpiry')}
                className={cn(inputCls, 'font-mono')}
              />
            </Field>
          </div>

          {globalError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm font-bold">
              {globalError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/superadmin/tenants')}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  Creando…
                </>
              ) : (
                <>
                  <Building2 className="h-3.5 w-3.5" />
                  Registrar OTEC
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

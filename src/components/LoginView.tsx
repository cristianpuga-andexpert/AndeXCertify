import React, { useState } from 'react';
import { LogIn, Mail, Lock, AlertCircle, FileCheck2, GraduationCap, Users, CheckCircle2 } from 'lucide-react';
import logoLight from '../assets/logo-light.png';
import logoDark  from '../assets/logo-dark.png';
import { useAuth } from '../lib/auth-context';
import { motion } from 'motion/react';

const AUTH_ERRORS: Record<string, string> = {
  'Invalid credentials':             'Correo o contraseña incorrectos.',
  'Correo o contraseña incorrectos': 'Correo o contraseña incorrectos.',
  'Account is disabled':             'Esta cuenta ha sido desactivada.',
  'Too many':                        'Demasiados intentos. Intente más tarde.',
  'Password must be':                'La contraseña debe tener al menos 8 caracteres.',
  'already registered':              'Este correo ya está registrado.',
};

function friendlyError(message: string): string {
  for (const [key, val] of Object.entries(AUTH_ERRORS)) {
    if (message.includes(key)) return val;
  }
  return message || 'Error al iniciar sesión. Intente nuevamente.';
}

const FEATURES = [
  { icon: FileCheck2,   text: 'Emisión digital de certificados con respaldo en nube' },
  { icon: GraduationCap, text: 'Gestión completa de cursos y participantes' },
  { icon: CheckCircle2, text: 'Control de acreditación SENCE integrado' },
  { icon: Users,        text: 'Administración multi-OTEC desde un solo panel' },
];

export function LoginView() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(friendlyError(err?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">

      {/* ── Panel izquierdo — branding y propuesta de valor ────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex-col justify-between p-14">

        {/* Luces de fondo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.18)_0%,_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(79,70,229,0.12)_0%,_transparent_55%)]" />

        {/* Grilla sutil */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        {/* Círculo decorativo */}
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full border border-white/5" />
        <div className="absolute -bottom-16 -right-16 h-[320px] w-[320px] rounded-full border border-brand/10" />

        {/* Branding superior */}
        <div className="relative z-10">
          <div className="mb-20">
            <img src={logoDark} alt="AndeXCertify" className="h-28 w-auto max-w-xs" />
          </div>

          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight mb-5">
            Plataforma de<br />
            <span className="text-brand">Certificación</span><br />
            para OTECs
          </h1>
          <p className="text-slate-400 text-[15px] font-medium leading-relaxed max-w-xs">
            Emite, gestiona y valida certificados digitales de capacitación
            en un solo lugar, con trazabilidad SENCE.
          </p>
        </div>

        {/* Características */}
        <div className="relative z-10 space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-brand" />
              </div>
              <span className="text-slate-300 text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">
            Un producto de AndeXpert Solutions © 2026
          </p>
        </div>
      </div>

      {/* ── Panel derecho — formulario ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 relative">

        {/* Branding mobile (solo visible en pantallas pequeñas) */}
        <div className="lg:hidden flex justify-center mb-10">
          <img src={logoLight} alt="AndeXCertify" className="h-16 w-auto" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <h2 className="text-[26px] font-black text-slate-900 tracking-tight">Iniciar sesión</h2>
            <p className="text-slate-500 text-sm font-medium mt-1.5">
              Ingresa tus credenciales para acceder a la plataforma
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs font-semibold text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@otec.cl"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3.5 text-[11px] font-black tracking-[0.2em] uppercase flex items-center justify-center gap-2 mt-1 shadow-lg hover:shadow-brand/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogIn className="h-4 w-4" />
              <span>{loading ? 'Verificando...' : 'Ingresar'}</span>
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-400 font-medium mt-10">
            Un producto de{' '}
            <span className="text-slate-600 font-bold">AndeXpert Solutions</span> © 2026
          </p>
        </motion.div>
      </div>
    </div>
  );
}

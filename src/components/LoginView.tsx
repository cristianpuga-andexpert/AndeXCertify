import React, { useState } from 'react';
import { Award, LogIn, ShieldCheck, Mail, Lock, AlertCircle } from 'lucide-react';
import { signInWithGoogle, signInWithEmail } from '../lib/supabase';
import { motion } from 'motion/react';

const SUPABASE_ERRORS: Record<string, string> = {
  'Invalid login credentials':    'Correo o contraseña incorrectos.',
  'Email not confirmed':          'Debes confirmar tu correo antes de ingresar.',
  'User not found':               'No existe una cuenta con este correo.',
  'Too many requests':            'Demasiados intentos. Intente más tarde.',
  'User is banned':               'Esta cuenta ha sido desactivada.',
};

function friendlyError(message: string): string {
  for (const [key, val] of Object.entries(SUPABASE_ERRORS)) {
    if (message.includes(key)) return val;
  }
  return 'Error al iniciar sesión. Intente nuevamente.';
}

export function LoginView() {
  const [mode, setMode] = useState<'email' | 'google'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await signInWithEmail(email, password);
      if (err) throw err;
    } catch (err: any) {
      setError(friendlyError(err?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) setError(friendlyError(err.message));
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 blur-[180px] rounded-full -translate-y-1/2 translate-x-1/2 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-blue-600/5 blur-[180px] rounded-full translate-y-1/2 -translate-x-1/2" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'circOut' }}
        className="w-full max-w-md z-10"
      >
        {/* Brand */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="h-20 w-20 bg-brand rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.3)] flex items-center justify-center mb-6 relative group">
            <Award className="h-10 w-10 text-white z-10" />
            <div className="absolute inset-0 bg-white/20 rounded-3xl scale-0 group-hover:scale-100 transition-transform duration-500" />
          </div>
          <h2 className="text-white font-black text-2xl tracking-tighter">
            AndeX<span className="text-brand">Certify</span>
          </h2>
          <div className="flex items-center space-x-2 mt-2 opacity-50">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white">Trust Infrastructure</span>
          </div>
        </div>

        <div className="card-base bg-white/95 backdrop-blur-2xl p-10 border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
          <div className="flex items-center space-x-2 mb-6 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 w-fit mx-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Punto de Acceso</span>
          </div>

          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2 text-center">
            Protocolo de <span className="text-brand">Emisor</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium text-center mb-8">
            Autorice su acceso para gestionar el registro de certificaciones.
          </p>

          {/* Mode toggle */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              onClick={() => { setMode('email'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Correo
            </button>
            <button
              onClick={() => { setMode('google'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === 'google' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Google
            </button>
          </div>

          {error && (
            <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs font-medium text-red-600">{error}</p>
            </div>
          )}

          {mode === 'email' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-4 text-[10px] font-black tracking-[0.3em] uppercase shadow-2xl hover:shadow-brand/40 flex items-center justify-center space-x-3 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                <LogIn className="h-4 w-4" />
                <span>{loading ? 'Verificando...' : 'Iniciar Sesión'}</span>
              </button>
            </form>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="w-full btn-primary py-5 text-[10px] font-black tracking-[0.3em] uppercase shadow-2xl hover:shadow-brand/40 flex items-center justify-center space-x-3 transition-all transform hover:-translate-y-1 active:scale-95"
            >
              <LogIn className="h-5 w-5" />
              <span>Continuar con Google</span>
            </button>
          )}

          <div className="mt-10 flex items-center space-x-4 opacity-10 select-none justify-center">
            <div className="h-px w-8 bg-slate-900" />
            <span className="text-[9px] font-black text-slate-950 uppercase tracking-widest">Handshake</span>
            <div className="h-px w-8 bg-slate-900" />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center opacity-40">
          <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">AndeX Certification Authority © 2024</p>
        </div>
      </motion.div>
    </div>
  );
}

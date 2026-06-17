import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import logoDark from '../assets/logo-dark.png';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token    = params.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo restablecer la contraseña');
      setDone(true);
      setTimeout(() => navigate('/login'), 2200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[160px] rounded-full -translate-y-1/3 translate-x-1/3" />

      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }} className="w-full max-w-md z-10"
      >
        <div className="flex justify-center mb-8">
          <img src={logoDark} alt="AndeXCertify" className="h-16 w-auto" />
        </div>

        <div className="bg-white rounded-3xl p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
          {done ? (
            <div className="text-center py-6">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h1 className="text-xl font-black text-slate-900 mb-2">Contraseña actualizada</h1>
              <p className="text-slate-500 text-sm">Redirigiendo al inicio de sesión…</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1.5">Nueva contraseña</h1>
              <p className="text-slate-500 text-sm font-medium mb-6">Elige una contraseña segura para tu cuenta.</p>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-xs font-semibold text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type={showPass ? 'text' : 'password'} required minLength={8}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type={showPass ? 'text' : 'password'} required
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Repite la contraseña"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="w-full btn-primary py-3.5 text-[11px] font-black tracking-[0.2em] uppercase mt-2 disabled:opacity-60">
                  {loading ? 'Guardando…' : 'Restablecer contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

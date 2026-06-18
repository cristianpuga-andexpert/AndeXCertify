import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, AlertCircle, CheckCircle2, Eye, EyeOff, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth-context';
import logoDark from '../assets/logo-dark.png';

interface InviteInfo {
  email:        string;
  organization: string;
  role:         string;
}

export function SetPassword() {
  const [params]   = useSearchParams();
  const token      = params.get('token') ?? '';
  const navigate   = useNavigate();
  const { acceptInvitation } = useAuth();

  const [info,      setInfo]      = useState<InviteInfo | null>(null);
  const [checking,  setChecking]  = useState(true);
  const [invalid,   setInvalid]   = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  // Validate the token on mount
  useEffect(() => {
    if (!token) { setInvalid('Falta el token de invitación.'); setChecking(false); return; }
    fetch(`/api/auth/invitation/${token}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invitación inválida');
        setInfo(data as InviteInfo);
      })
      .catch(err => setInvalid(err.message))
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      await acceptInvitation(token, password, firstName || undefined, lastName || undefined);
      navigate('/'); // auto-logged in
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[160px] rounded-full -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/5 blur-[160px] rounded-full translate-y-1/3 -translate-x-1/3" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        <div className="flex justify-center mb-8">
          <img src={logoDark} alt="AndeXCertify" className="h-16 w-auto" />
        </div>

        <div className="bg-white rounded-3xl p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
          {checking ? (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
              <p className="text-slate-400 text-sm font-medium">Validando invitación…</p>
            </div>
          ) : invalid ? (
            <div className="text-center py-6">
              <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-7 w-7 text-red-500" />
              </div>
              <h1 className="text-xl font-black text-slate-900 mb-2">Invitación no válida</h1>
              <p className="text-slate-500 text-sm mb-6">{invalid}</p>
              <button onClick={() => navigate('/login')} className="btn-primary mx-auto">
                Ir a iniciar sesión
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full mb-4">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Invitación válida</span>
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Activa tu cuenta</h1>
                <p className="text-slate-500 text-sm font-medium mt-1.5">
                  Te uniste a <span className="font-bold text-slate-700">{info?.organization}</span>. Define tu contraseña para entrar.
                </p>
              </div>

              {/* Email (read-only) */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-600 truncate">{info?.email}</span>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-xs font-semibold text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nombre</label>
                    <input
                      type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder="Juan"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Apellido</label>
                    <input
                      type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder="Pérez"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                    />
                  </div>
                </div>

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

                <button
                  type="submit" disabled={loading}
                  className="w-full btn-primary py-3.5 text-[11px] font-black tracking-[0.2em] uppercase flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4" />
                  {loading ? 'Activando…' : 'Activar cuenta e ingresar'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-600 font-medium mt-8 uppercase tracking-[0.3em]">
          Un producto de AndeXpert Solutions
        </p>
      </motion.div>
    </div>
  );
}

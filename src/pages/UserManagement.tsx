import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, ShieldOff, Trash2, X, AlertCircle, CheckCircle, RefreshCw, Mail, Clock, Copy } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';
import { AppUser } from '../types';
import { cn } from '../lib/utils';

interface InviteForm {
  email: string;
  displayName: string;
  role: 'admin' | 'instructor' | 'empresa' | 'alumno';
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

const INITIAL_FORM: InviteForm = { email: '', displayName: '', role: 'admin' };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', instructor: 'Instructor', empresa: 'Empresa', alumno: 'Alumno', user: 'Usuario',
};

export function UserManagement() {
  const { user } = useAuth();
  const isAdmin = !!user;
  const [users, setUsers]       = useState<AppUser[]>([]);
  const [invites, setInvites]   = useState<PendingInvite[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState<InviteForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, inv] = await Promise.all([
        api.get<{ users: AppUser[] }>('/api/admin/users'),
        api.get<{ invitations: PendingInvite[] }>('/api/admin/invitations'),
      ]);
      setUsers(u.users ?? []);
      setInvites(inv.invitations ?? []);
    } catch {
      setUsers([]); setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setInviteLink(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ emailSent: boolean; inviteLink?: string }>('/api/admin/create-user', form);
      setShowModal(false);
      if (res.emailSent) {
        setSuccessMsg(`Invitación enviada a ${form.email}.`);
      } else {
        setSuccessMsg(`Invitación creada para ${form.email}. SMTP no configurado — copia el enlace abajo.`);
        setInviteLink(res.inviteLink ?? null);
      }
      setForm(INITIAL_FORM);
      await fetchData();
      setTimeout(() => setSuccessMsg(''), 8000);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: AppUser) => {
    setActionLoading(u.id);
    try {
      await api.patch(`/api/admin/users/${u.id}`, { isActive: !u.isActive });
      await fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`¿Quitar a ${u.email} de la organización?`)) return;
    setActionLoading(u.id);
    try {
      await api.del(`/api/admin/users/${u.id}`);
      await fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleCancelInvite = async (id: string) => {
    setActionLoading(id);
    try {
      await api.del(`/api/admin/invitations/${id}`);
      await fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  if (!isAdmin) {
    return (
      <div className="p-10 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Acceso restringido a administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">
            <div className="h-1 w-1 rounded-full bg-slate-400"></div>
            <span>Opciones Globales</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
            Gestión de <span className="text-brand">Usuarios</span>
          </h1>
          <p className="text-slate-500 mt-2 font-medium text-xs uppercase tracking-widest opacity-60">
            Invita y administra el acceso de tu organización
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setFormError(''); setForm(INITIAL_FORM); }}
          className="btn-primary flex items-center space-x-2 px-5 py-3 text-[10px] font-black tracking-widest uppercase"
        >
          <UserPlus className="h-4 w-4" />
          <span>Invitar Usuario</span>
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 mb-6">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-700">{successMsg}</p>
          </div>
          {inviteLink && (
            <div className="flex items-center gap-2 mt-3 bg-white border border-emerald-200 rounded-lg px-3 py-2">
              <input readOnly value={inviteLink} onFocus={e => e.currentTarget.select()}
                className="flex-1 bg-transparent text-[11px] font-mono text-brand outline-none truncate" />
              <button onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand">
                <Copy className="h-3 w-3" /> Copiar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending invitations */}
      {invites.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden mb-6">
          <div className="px-6 py-3 border-b border-amber-200 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
              Invitaciones pendientes ({invites.length})
            </span>
          </div>
          <div className="divide-y divide-amber-100">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{inv.email}</p>
                    <p className="text-[11px] text-slate-500">
                      {ROLE_LABELS[inv.role] ?? inv.role} · expira {new Date(inv.expiresAt).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(inv.id)}
                  disabled={actionLoading === inv.id}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
                >
                  {actionLoading === inv.id ? '…' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 text-brand animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <Users className="h-10 w-10 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No hay usuarios activos aún.</p>
            <p className="text-slate-400 text-sm mt-1">Invita al primero con el botón de arriba.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Usuario</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Rol</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Creado</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-brand font-black text-xs uppercase">{u.email[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{u.displayName || '—'}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                      u.role === 'admin' ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'
                    )}>
                      <Shield className="h-3 w-3" />
                      <span>{ROLE_LABELS[u.role] ?? u.role}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                      u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    )}>
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={actionLoading === u.id}
                        title={u.isActive ? 'Desactivar' : 'Activar'}
                        className={cn(
                          'h-8 w-8 flex items-center justify-center rounded-lg transition-colors',
                          u.isActive ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'
                        )}
                      >
                        {actionLoading === u.id ? <RefreshCw className="h-4 w-4 animate-spin" />
                          : u.isActive ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={actionLoading === u.id}
                        title="Quitar de la organización"
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <ModalWrapper>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Invitar Usuario</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Recibirá un correo para definir su contraseña.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="p-6 space-y-5">
                {formError && (
                  <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs font-medium text-red-600">{formError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nombre completo <span className="text-slate-400 normal-case tracking-normal">(opcional)</span></label>
                  <input
                    type="text" value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Juan Pérez"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Correo electrónico</label>
                  <input
                    type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Rol</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as InviteForm['role'] })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                  >
                    <option value="admin">Administrador</option>
                    <option value="instructor">Instructor</option>
                    <option value="empresa">Empresa</option>
                    <option value="alumno">Alumno</option>
                  </select>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 btn-primary py-3 text-[10px] font-black tracking-widest uppercase disabled:opacity-60">
                    {submitting ? 'Enviando...' : 'Enviar invitación'}
                  </button>
                </div>
              </form>
            </div>
          </ModalWrapper>
        </div>
      )}
    </div>
  );
}

function ModalWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ animation: 'modalIn 0.2s ease-out' }}>
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }`}</style>
      {children}
    </div>
  );
}

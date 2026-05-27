import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, ShieldOff, Trash2, X, Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { AppUser } from '../types';
import { cn } from '../lib/utils';

interface CreateUserForm {
  email: string;
  password: string;
  displayName: string;
  role: 'admin' | 'user';
}

const INITIAL_FORM: CreateUserForm = {
  email: '',
  password: '',
  displayName: '',
  role: 'user',
};

export function UserManagement() {
  const { user } = useAuth();
  const isAdmin = !!user; // TODO: implement role check via API in Task 5
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [rulesError, setRulesError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(INITIAL_FORM);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('No autenticado');
    return token;
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setRulesError(false);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        setRulesError(true);
        setUsers([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar usuarios');
      setUsers(data.users ?? []);
    } catch (err: any) {
      if (err.message?.includes('rules') || err.message?.includes('PERMISSION_DENIED')) {
        setRulesError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al crear usuario');
      setSuccessMsg(`Usuario ${form.email} creado exitosamente.`);
      setShowModal(false);
      setForm(INITIAL_FORM);
      await fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    setActionLoading(user.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al actualizar usuario');
      }
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (!confirm(`¿Eliminar permanentemente a ${user.email}? Esta acción no se puede deshacer.`)) return;
    setActionLoading(user.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al eliminar usuario');
      }
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
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
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Gestión de <span className="text-brand">Usuarios</span></h1>
          <p className="text-slate-500 mt-2 font-medium text-xs uppercase tracking-widest opacity-60">Cuentas de acceso a la plataforma</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setFormError(''); setForm(INITIAL_FORM); }}
          className="btn-primary flex items-center space-x-2 px-5 py-3 text-[10px] font-black tracking-widest uppercase"
        >
          <UserPlus className="h-4 w-4" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 mb-6">
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-sm font-medium text-emerald-700">{successMsg}</p>
        </div>
      )}

      {/* Rules not deployed banner */}
      {rulesError && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-800 mb-1">Reglas de Firestore pendientes</p>
              <p className="text-xs text-amber-700 mb-3">
                Para listar usuarios desde Firestore, debes desplegar las reglas de seguridad actualizadas.
                Ejecuta en la terminal del proyecto:
              </p>
              <code className="block bg-amber-900/10 text-amber-900 text-xs font-mono px-4 py-2 rounded-lg">
                firebase login &amp;&amp; firebase deploy --only firestore:rules
              </code>
              <p className="text-xs text-amber-600 mt-2">
                Los usuarios creados a través de esta pantalla quedan activos en Firebase Auth aunque no aparezcan en la lista.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 text-brand animate-spin" />
          </div>
        ) : users.length === 0 && !rulesError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <Users className="h-10 w-10 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No hay usuarios registrados aún.</p>
            <p className="text-slate-400 text-sm mt-1">Crea el primer usuario con el botón de arriba.</p>
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
                      u.role === 'admin'
                        ? 'bg-brand/10 text-brand'
                        : 'bg-slate-100 text-slate-600'
                    )}>
                      <Shield className="h-3 w-3" />
                      <span>{u.role === 'admin' ? 'Administrador' : 'Usuario'}</span>
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
                          u.isActive
                            ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                            : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'
                        )}
                      >
                        {actionLoading === u.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : u.isActive ? (
                          <ShieldOff className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={actionLoading === u.id}
                        title="Eliminar"
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

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <ModalWrapper>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Crear Nuevo Usuario</h2>
                  <p className="text-xs text-slate-500 mt-0.5">El usuario podrá acceder con correo y contraseña.</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-5">
                {formError && (
                  <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs font-medium text-red-600">{formError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Juan Pérez"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Rol
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'user' })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                  >
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 btn-primary py-3 text-[10px] font-black tracking-widest uppercase disabled:opacity-60"
                  >
                    {submitting ? 'Creando...' : 'Crear Usuario'}
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
    <div
      style={{
        animation: 'modalIn 0.2s ease-out',
      }}
    >
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }`}</style>
      {children}
    </div>
  );
}

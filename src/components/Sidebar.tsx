import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Award,
  ShieldCheck,
  Settings,
  Users,
  FileStack,
  Building2,
  UserCheck,
} from 'lucide-react';
import { logOut } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { cn } from '../lib/utils';

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();

  const displayName: string =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuario';
  const avatarUrl: string | undefined =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  // "Panel de Control" activo en cualquier ruta de cursos excepto /courses/new
  const isDashboardActive =
    location.pathname === '/' ||
    (location.pathname.startsWith('/courses') && location.pathname !== '/courses/new');

  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <div className="w-72 bg-slate-950 border-r border-white/5 flex flex-col h-screen shrink-0 z-50">
      {/* Brand Header */}
      <div className="p-8 pb-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="h-10 w-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Award className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter leading-none">
              AndeX<span className="text-brand">Certify</span>
            </h2>
            <div className="flex items-center space-x-1.5 mt-1.5 opacity-40">
              <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Secure Ledger</span>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {/* Panel de Control — activo en todas las rutas de cursos */}
          <NavLink
            to="/"
            className={cn(
              'flex items-center space-x-3 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all group',
              isDashboardActive
                ? 'bg-brand text-white shadow-xl shadow-indigo-500/20'
                : 'text-slate-500 hover:text-white hover:bg-white/5'
            )}
          >
            <LayoutDashboard className={cn(
              'h-5 w-5 transition-transform group-hover:scale-110',
              isDashboardActive ? 'text-white' : 'text-slate-600 group-hover:text-brand'
            )} />
            <span>Panel de Control</span>
          </NavLink>

          {/* Plantillas */}
          <NavLink
            to="/templates"
            className={({ isActive }) => cn(
              'flex items-center space-x-3 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all group',
              isActive
                ? 'bg-brand text-white shadow-xl shadow-indigo-500/20'
                : 'text-slate-500 hover:text-white hover:bg-white/5'
            )}
          >
            {({ isActive }) => (
              <>
                <FileStack className={cn('h-5 w-5 transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-slate-600 group-hover:text-brand')} />
                <span>Plantillas</span>
              </>
            )}
          </NavLink>
        </nav>
      </div>

      {/* Global Options */}
      <div className="px-8 flex-1">
        <div className="h-px w-full bg-white/5 mb-8" />
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-6">Opciones Globales</p>

        <div className="space-y-4">
          {/* Usuarios */}
          <NavLink
            to="/users"
            className={({ isActive }) => cn(
              'flex items-center space-x-3 text-[10px] font-bold uppercase tracking-widest transition-all group',
              isActive ? 'text-brand' : 'text-slate-500 hover:text-white'
            )}
          >
            <Users className="h-4 w-4" />
            <span>Usuarios</span>
          </NavLink>

          {/* Configuración — con sub-menú */}
          <div className="space-y-2">
            {/* Encabezado del grupo */}
            <div className={cn(
              'flex items-center space-x-3 text-[10px] font-bold uppercase tracking-widest',
              isSettingsActive ? 'text-brand' : 'text-slate-500'
            )}>
              <Settings className="h-4 w-4 shrink-0" />
              <span>Configuración</span>
            </div>

            {/* Sub-items — siempre visibles */}
            <div className="ml-7 pl-3 border-l border-white/10 space-y-2.5">
              <NavLink
                to="/settings/institutional"
                className={({ isActive }) => cn(
                  'flex items-center space-x-2 text-[9px] font-bold uppercase tracking-widest transition-colors',
                  isActive ? 'text-brand' : 'text-slate-600 hover:text-white'
                )}
              >
                <Building2 className="h-3 w-3 shrink-0" />
                <span>Institucional</span>
              </NavLink>
              <NavLink
                to="/settings/representatives"
                className={({ isActive }) => cn(
                  'flex items-center space-x-2 text-[9px] font-bold uppercase tracking-widest transition-colors',
                  isActive ? 'text-brand' : 'text-slate-600 hover:text-white'
                )}
              >
                <UserCheck className="h-3 w-3 shrink-0" />
                <span>Representantes</span>
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      {/* User Session Info */}
      <div className="mt-auto p-8 border-t border-white/5 bg-slate-950/50 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="User"
                className="h-9 w-9 rounded-xl border border-white/10 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                <span className="text-brand font-black text-xs uppercase">
                  {displayName[0]}
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Identidad</span>
              <span className="text-[10px] font-bold text-white truncate max-w-[100px]">
                {displayName}
              </span>
            </div>
          </div>

          <button
            onClick={() => logOut()}
            className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors group"
            title="Cerrar Sesión"
          >
            <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

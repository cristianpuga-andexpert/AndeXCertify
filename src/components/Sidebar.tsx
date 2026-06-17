import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  FileStack,
  Building2,
  UserCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { cn } from '../lib/utils';
import logoLight from '../assets/logo-light.png';
import logoDark  from '../assets/logo-dark.png';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const displayName: string =
    (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null) ||
    user?.firstName ||
    user?.email?.split('@')[0] ||
    'Usuario';

  const isDashboardActive =
    location.pathname === '/' ||
    (location.pathname.startsWith('/courses') && location.pathname !== '/courses/new');

  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <div className="w-72 bg-slate-950 light:bg-white border-r border-white/5 light:border-slate-200 flex flex-col h-screen shrink-0 z-50 transition-colors duration-200">

      {/* Brand Header */}
      <div className="p-8 pb-6">
        <div className="mb-8">
          <img src={logoDark}  alt="AndeXCertify" className="h-[72px] w-auto block light:hidden" />
          <img src={logoLight} alt="AndeXCertify" className="h-[72px] w-auto hidden light:block" />
        </div>

        <nav className="space-y-1">
          <NavLink
            to="/"
            className={cn(
              'flex items-center space-x-3 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all group',
              isDashboardActive
                ? 'bg-brand text-white shadow-xl shadow-indigo-500/20'
                : 'text-slate-500 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:bg-white/5 light:hover:bg-slate-100'
            )}
          >
            <LayoutDashboard className={cn(
              'h-5 w-5 transition-transform group-hover:scale-110',
              isDashboardActive ? 'text-white' : 'text-slate-600 group-hover:text-brand'
            )} />
            <span>Panel de Control</span>
          </NavLink>

          <NavLink
            to="/templates"
            className={({ isActive }) => cn(
              'flex items-center space-x-3 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all group',
              isActive
                ? 'bg-brand text-white shadow-xl shadow-indigo-500/20'
                : 'text-slate-500 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:bg-white/5 light:hover:bg-slate-100'
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
        <div className="h-px w-full bg-white/5 light:bg-slate-200 mb-8" />
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-6">Opciones Globales</p>

        <div className="space-y-4">
          <NavLink
            to="/users"
            className={({ isActive }) => cn(
              'flex items-center space-x-3 text-[10px] font-bold uppercase tracking-widest transition-all group',
              isActive ? 'text-brand' : 'text-slate-500 light:text-slate-600 hover:text-white light:hover:text-slate-900'
            )}
          >
            <Users className="h-4 w-4" />
            <span>Usuarios</span>
          </NavLink>

          <div className="space-y-2">
            <div className={cn(
              'flex items-center space-x-3 text-[10px] font-bold uppercase tracking-widest',
              isSettingsActive ? 'text-brand' : 'text-slate-500 light:text-slate-600'
            )}>
              <Settings className="h-4 w-4 shrink-0" />
              <span>Configuración</span>
            </div>

            <div className="ml-7 pl-3 border-l border-white/10 light:border-slate-200 space-y-2.5">
              <NavLink
                to="/settings/institutional"
                className={({ isActive }) => cn(
                  'flex items-center space-x-2 text-[9px] font-bold uppercase tracking-widest transition-colors',
                  isActive ? 'text-brand' : 'text-slate-600 hover:text-white light:hover:text-slate-900'
                )}
              >
                <Building2 className="h-3 w-3 shrink-0" />
                <span>Institucional</span>
              </NavLink>
              <NavLink
                to="/settings/representatives"
                className={({ isActive }) => cn(
                  'flex items-center space-x-2 text-[9px] font-bold uppercase tracking-widest transition-colors',
                  isActive ? 'text-brand' : 'text-slate-600 hover:text-white light:hover:text-slate-900'
                )}
              >
                <UserCheck className="h-3 w-3 shrink-0" />
                <span>Representantes</span>
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      {/* User Session + Theme Toggle */}
      <div className="mt-auto p-8 border-t border-white/5 light:border-slate-200 bg-slate-950/50 light:bg-slate-50 backdrop-blur-md transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
              <span className="text-brand font-black text-xs uppercase">
                {displayName[0]}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Identidad</span>
              <span className="text-[10px] font-bold text-white light:text-slate-900 truncate max-w-[100px]">
                {displayName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-brand transition-colors rounded-lg hover:bg-white/5 light:hover:bg-slate-100"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />
              }
            </button>

            {/* Logout */}
            <button
              onClick={() => logout()}
              className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors group"
              title="Cerrar Sesión"
            >
              <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

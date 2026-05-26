import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  LogOut, 
  Award, 
  ShieldCheck,
  Settings,
  Users,
  FileStack
} from 'lucide-react';
import { logOut } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { cn } from '../lib/utils';

export function Sidebar() {
  const { user } = useAuth();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Panel de Control' },
    { to: '/courses/new', icon: PlusCircle, label: 'Nuevo Curso' },
    { to: '/templates', icon: FileStack, label: 'Plantillas' },
  ];

  return (
    <div className="w-72 bg-slate-950 border-r border-white/5 flex flex-col h-screen sticky top-0 shrink-0 z-50">
      {/* Brand Header */}
      <div className="p-8 pb-12">
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

        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center space-x-3 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all group",
                isActive 
                  ? "bg-brand text-white shadow-xl shadow-indigo-500/20" 
                  : "text-slate-500 hover:text-white hover:bg-white/5"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform group-hover:scale-110",
                    isActive ? "" : "text-slate-600 group-hover:text-brand"
                  )} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Other Options / Placeholder */}
      <div className="px-8 flex-1">
        <div className="h-px w-full bg-white/5 mb-8"></div>
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-6">Opciones Globales</p>
        
        <div className="space-y-4">
           <button className="flex items-center space-x-3 text-slate-500 hover:text-white transition-colors group cursor-not-allowed opacity-30">
              <Users className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Base de Firmas</span>
           </button>
           <NavLink 
             to="/settings"
             className={({ isActive }) => cn(
               "flex items-center space-x-3 text-[10px] font-bold uppercase tracking-widest transition-all group",
               isActive ? "text-brand" : "text-slate-500 hover:text-white"
             )}
           >
              <Settings className="h-4 w-4" />
              <span>Configuración</span>
           </NavLink>
        </div>
      </div>

      {/* User Session Info */}
      <div className="mt-auto p-8 border-t border-white/5 bg-slate-950/50 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User" className="h-9 w-9 rounded-xl border border-white/10" referrerPolicy="no-referrer" />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                <span className="text-brand font-black text-xs uppercase">{user?.email?.[0]}</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Identidad</span>
              <span className="text-[10px] font-bold text-white truncate max-w-[100px]">
                {user?.displayName || user?.email?.split('@')[0]}
              </span>
            </div>
          </div>
          
          <button 
            onClick={logOut}
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

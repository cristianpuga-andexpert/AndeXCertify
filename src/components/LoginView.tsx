import React from 'react';
import { Award, LogIn, ShieldCheck } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';
import { motion } from 'motion/react';

export function LoginView() {
  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 blur-[180px] rounded-full -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-blue-600/5 blur-[180px] rounded-full translate-y-1/2 -translate-x-1/2"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "circOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="flex flex-col items-center mb-10 text-center">
            <div className="h-20 w-20 bg-brand rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.3)] flex items-center justify-center mb-6 relative group">
              <Award className="h-10 w-10 text-white z-10" />
              <div className="absolute inset-0 bg-white/20 rounded-3xl scale-0 group-hover:scale-100 transition-transform duration-500"></div>
            </div>
            <h2 className="text-white font-black text-2xl tracking-tighter">
               AndeX<span className="text-brand">Certify</span>
            </h2>
            <div className="flex items-center space-x-2 mt-2 opacity-50">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white">Trust Infrastructure</span>
            </div>
        </div>

        <div className="card-base bg-white/95 backdrop-blur-2xl p-12 border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center space-x-2 mb-4 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Punto de Acceso</span>
            </div>
            
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-6">
              Protocolo de <span className="text-brand">Emisor</span>
            </h1>
            
            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-10">
              Autorice su acceso para gestionar el registro centralizado de emisión y validación de certificaciones profesionales.
            </p>

            <button 
              onClick={signInWithGoogle}
              className="w-full btn-primary py-5 text-[10px] font-black tracking-[0.3em] uppercase shadow-2xl hover:shadow-brand/40 flex items-center justify-center space-x-3 transition-all transform hover:-translate-y-1 active:scale-95"
            >
              <LogIn className="h-5 w-5" />
              <span>Iniciar Autenticación</span>
            </button>
            
            <div className="mt-12 flex items-center space-x-4 opacity-10 select-none">
              <div className="h-px w-8 bg-slate-900"></div>
              <span className="text-[9px] font-black text-slate-950 uppercase tracking-widest">Handshake</span>
              <div className="h-px w-8 bg-slate-900"></div>
            </div>
          </div>
        </div>
        
        <div className="mt-12 flex flex-col items-center opacity-40">
           <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">AndeX Certification Authority © 2024</p>
        </div>
      </motion.div>
    </div>
  );
}

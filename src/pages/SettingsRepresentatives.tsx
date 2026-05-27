import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Trash2,
  PenTool,
  Eraser,
  CheckCircle2,
  Upload,
  AlertCircle,
  X,
} from 'lucide-react';
import { Representative } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import { api } from '../lib/api';

export function SettingsRepresentatives() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [isAddingRep, setIsAddingRep] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newRep, setNewRep] = useState({ name: '', rut: '', signatureUrl: '' });
  const [signatureType, setSignatureType] = useState<'draw' | 'upload'>('draw');
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (!user) return;
    api.get<Representative[]>('/api/representatives')
      .then(setRepresentatives)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
    setNewRep(prev => ({ ...prev, signatureUrl: '' }));
  };

  const handleSaveRep = async () => {
    if (!user || !newRep.name || !newRep.rut) return;

    let signatureUrl = newRep.signatureUrl;
    if (signatureType === 'draw' && sigCanvas.current) {
      if (sigCanvas.current.isEmpty()) {
        alert('Por favor proporcione una firma.');
        return;
      }
      signatureUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    }

    if (!signatureUrl) {
      alert('Por favor proporcione una firma.');
      return;
    }

    try {
      const rep = await api.post<Representative>('/api/representatives', {
        name: newRep.name,
        rut: newRep.rut,
        signatureUrl,
      });
      setRepresentatives(prev => [rep, ...prev]);
      setIsAddingRep(false);
      setNewRep({ name: '', rut: '', signatureUrl: '' });
      setSignatureType('draw');
    } catch (err: any) {
      alert('Error al guardar representante: ' + err.message);
    }
  };

  const handleDeleteRep = async (id: string) => {
    if (!user) return;
    try {
      await api.del(`/api/representatives/${id}`);
      setRepresentatives(prev => prev.filter(r => r.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      alert('Error al eliminar representante: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1500000) {
      alert('La imagen de la firma es demasiado grande (Máximo 1.5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      let base64 = reader.result as string;

      if (base64.length > 500000) {
        const img = new Image();
        img.src = base64;
        await new Promise(r => { img.onload = r; });
        const canvas = document.createElement('canvas');
        const MAX_DIM = 600;
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height = (height * MAX_DIM) / width; width = MAX_DIM; }
          else { width = (width * MAX_DIM) / height; height = MAX_DIM; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        base64 = canvas.toDataURL('image/png', 0.7);
      }

      setNewRep(prev => ({ ...prev, signatureUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
        <span className="text-[10px] font-black text-brand uppercase tracking-widest">Cargando representantes...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold text-brand uppercase tracking-[0.2em] mb-2">
            <div className="h-1 w-1 rounded-full bg-brand animate-pulse" />
            <span>Configuración Global</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
            Representantes <span className="text-brand">Legales</span>
          </h1>
          <p className="text-slate-500 mt-3 text-sm leading-relaxed">
            Firmantes autorizados para la emisión de certificados.
          </p>
        </div>
        {!isAddingRep && (
          <button
            onClick={() => setIsAddingRep(true)}
            className="btn-primary flex items-center space-x-2 py-3 px-6 shadow-xl shadow-brand/20 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Representante</span>
          </button>
        )}
      </div>

      {/* ── Formulario de nuevo representante ── */}
      <AnimatePresence>
        {isAddingRep && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="card-base mb-6 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-brand" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">
                  Nuevo Representante
                </h2>
              </div>
              <button
                onClick={() => { setIsAddingRep(false); setNewRep({ name: '', rut: '', signatureUrl: '' }); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={newRep.name}
                    onChange={(e) => setNewRep(prev => ({ ...prev, name: e.target.value }))}
                    className="input-base text-sm font-bold"
                    placeholder="Juan Pérez Palma"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    RUT Personal
                  </label>
                  <input
                    type="text"
                    value={newRep.rut}
                    onChange={(e) => setNewRep(prev => ({ ...prev, rut: e.target.value }))}
                    className="input-base text-sm font-mono"
                    placeholder="12.345.678-9"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Firma Autorizada
                  </label>
                  <div className="flex bg-white rounded-lg p-0.5 shadow-sm border border-slate-200">
                    {(['draw', 'upload'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSignatureType(type)}
                        className={cn(
                          'px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-md transition-all flex items-center space-x-1',
                          signatureType === type ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
                        )}
                      >
                        {type === 'draw'
                          ? <><PenTool className="h-3 w-3" /><span>Dibujar</span></>
                          : <><Upload className="h-3 w-3" /><span>Cargar</span></>
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {signatureType === 'draw' ? (
                  <div className="relative group">
                    <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-inner group-hover:border-brand/30 transition-colors">
                      <SignatureCanvas
                        ref={sigCanvas}
                        penColor="#0f172a"
                        canvasProps={{ className: 'w-full h-36' }}
                      />
                    </div>
                    <button
                      onClick={handleClearSignature}
                      className="absolute bottom-3 right-3 h-9 w-9 bg-slate-50 border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl flex items-center justify-center transition-all shadow-sm"
                      title="Limpiar firma"
                    >
                      <Eraser className="h-4 w-4" />
                    </button>
                    <div className="absolute top-3 left-3 flex items-center space-x-1.5 text-slate-300 pointer-events-none font-black text-[9px] uppercase tracking-widest">
                      <PenTool className="h-3 w-3" /><span>Área de captura digital</span>
                    </div>
                  </div>
                ) : (
                  <label className="relative block group cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    <div className="py-10 border-2 border-dashed border-slate-200 rounded-xl bg-white flex flex-col items-center justify-center group-hover:border-brand group-hover:bg-indigo-50/50 transition-all">
                      {newRep.signatureUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative">
                            <img src={newRep.signatureUrl} alt="Preview" className="h-20 object-contain" />
                            <button
                              onClick={() => setNewRep(prev => ({ ...prev, signatureUrl: '' }))}
                              className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-[8px] font-black uppercase text-brand tracking-widest">
                            Firma cargada
                          </span>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-7 w-7 text-slate-300 group-hover:text-brand transition-colors mb-2" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Click para cargar imagen
                          </span>
                          <span className="text-[8px] text-slate-300 mt-1 font-medium">
                            PNG transparente recomendado · Máx. 1.5 MB
                          </span>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              <div className="flex space-x-3 pt-1">
                <button
                  onClick={() => { setIsAddingRep(false); setNewRep({ name: '', rut: '', signatureUrl: '' }); }}
                  className="btn-secondary flex-1 py-3"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveRep}
                  className="btn-primary flex-1 py-3 flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Guardar Representante</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lista ── */}
      {representatives.length === 0 && !isAddingRep ? (
        <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-slate-200" />
          </div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Sin representantes registrados
          </h3>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            Agrega el primer firmante autorizado para los certificados.
          </p>
          <button
            onClick={() => setIsAddingRep(true)}
            className="mt-6 btn-primary inline-flex items-center space-x-2 py-2.5 px-6"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar representante</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {representatives.map((rep) => (
            <motion.div
              key={rep.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative bg-white border border-slate-200 rounded-2xl hover:border-brand hover:shadow-lg hover:shadow-indigo-500/5 transition-all overflow-hidden max-w-sm"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-900 tracking-tight truncate">{rep.name}</h4>
                  <p className="text-[9px] font-mono text-slate-400 mt-0.5">{rep.rut}</p>
                </div>
                <button
                  onClick={() => setDeletingId(rep.id!)}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="h-24 bg-slate-50 flex items-center justify-center overflow-hidden">
                <img
                  src={rep.signatureUrl}
                  alt={`Firma ${rep.name}`}
                  className="h-full w-full object-contain p-3"
                />
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between bg-white">
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  Activo
                </span>
                <span className="text-[8px] text-slate-400 font-mono">
                  {new Date(rep.createdAt!).toLocaleDateString('es-CL')}
                </span>
              </div>

              <AnimatePresence>
                {deletingId === rep.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/97 backdrop-blur-sm flex flex-col items-center justify-center p-5 text-center rounded-2xl"
                  >
                    <AlertCircle className="h-7 w-7 text-red-500 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-1">
                      ¿Eliminar representante?
                    </span>
                    <p className="text-[9px] text-slate-400 mb-4 leading-relaxed">
                      Se eliminará la firma de forma permanente.
                    </p>
                    <div className="flex space-x-2 w-full">
                      <button
                        onClick={() => setDeletingId(null)}
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDeleteRep(rep.id!)}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                      >
                        Eliminar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

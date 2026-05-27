import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Users,
  Plus,
  Save,
  Trash2,
  PenTool,
  Eraser,
  CheckCircle2,
  Upload,
  AlertCircle,
  X,
  Award,
} from 'lucide-react';
import { OrganizationSettings, Representative } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import { api } from '../lib/api';

export function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings>({
    name: '',
    rut: '',
    lema: '',
    useCustomStamp: false,
    customStampName: '',
    stampStyle: 'circular_double',
    logoUrl: '',
    updatedAt: new Date().toISOString(),
  });
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [isAddingRep, setIsAddingRep] = useState(false);
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newRep, setNewRep] = useState({ name: '', rut: '', signatureUrl: '' });
  const [signatureType, setSignatureType] = useState<'draw' | 'upload'>('draw');
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get<OrganizationSettings>('/api/settings'),
      api.get<Representative[]>('/api/representatives'),
    ])
      .then(([settings, reps]) => {
        if (settings && Object.keys(settings).length > 0) {
          setOrgSettings({
            ...settings,
            lema: settings.lema || '',
            useCustomStamp: !!settings.useCustomStamp,
            customStampName: settings.customStampName || '',
            stampStyle: settings.stampStyle || 'circular_double',
            logoUrl: settings.logoUrl || '',
          });
        }
        setRepresentatives(reps);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleOrgSave = async () => {
    if (!user) return;
    try {
      const saved = await api.put<OrganizationSettings>('/api/settings', orgSettings);
      setOrgSettings(saved);
      setShowSavedMsg(true);
      setTimeout(() => setShowSavedMsg(false), 3000);
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    }
  };

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
    setNewRep({ ...newRep, signatureUrl: '' });
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
    if (file) {
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

        setNewRep({ ...newRep, signatureUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      let base64 = reader.result as string;

      if (base64.length > 800000) {
        const img = new Image();
        img.src = base64;
        await new Promise(r => { img.onload = r; });
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 800;
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

      setOrgSettings({ ...orgSettings, logoUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    if (confirm('¿Está seguro de eliminar el logo institucional?')) {
      setOrgSettings({ ...orgSettings, logoUrl: '' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent"></div>
        <span className="text-[10px] font-black text-brand uppercase tracking-widest text-center">Iniciando Protocolos Administrativos...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-6">

      {/* ── Header ── */}
      <header>
        <div className="flex items-center space-x-2 text-[10px] font-bold text-brand uppercase tracking-[0.2em] mb-2">
          <div className="h-1 w-1 rounded-full bg-brand animate-pulse" />
          <span>Configuración Global</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
          Configuración <span className="text-brand">Institucional</span>
        </h1>
      </header>

      {/* ── Sección 1: Identidad Corporativa ── */}
      <section className="card-base">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-3">
          <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-brand" />
          </div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Identidad Corporativa</h2>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-8 items-start">
          {/* Logo upload — prominente */}
          <div className="flex flex-col items-center gap-3">
            <label className="relative group cursor-pointer">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <div className="h-36 w-36 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden group-hover:border-brand group-hover:bg-indigo-50/50 transition-all">
                {orgSettings.logoUrl ? (
                  <div className="relative h-full w-full group/logo">
                    <img src={orgSettings.logoUrl} alt="Logo" className="h-full w-full object-contain p-3" />
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveLogo(); }}
                      className="absolute top-1.5 right-1.5 bg-white/90 text-red-500 p-1 rounded-lg opacity-0 group-hover/logo:opacity-100 transition-opacity shadow-sm hover:bg-red-50"
                      title="Eliminar logo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-7 w-7 text-slate-300 group-hover:text-brand transition-colors" />
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Subir logo</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 bg-brand text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="h-3 w-3" />
              </div>
            </label>
            <p className="text-[8px] font-bold text-slate-400 text-center leading-relaxed">Logo institucional<br />PNG / JPG · Máx. 2 MB</p>
          </div>

          {/* Campos de identidad */}
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre de la OTEC / Entidad</label>
              <input
                type="text"
                value={orgSettings.name}
                onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                className="input-base text-sm font-bold"
                placeholder="Andexpert Solutions SpA"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">RUT Institucional</label>
              <input
                type="text"
                value={orgSettings.rut}
                onChange={(e) => setOrgSettings({ ...orgSettings, rut: e.target.value })}
                className="input-base text-sm font-mono"
                placeholder="76.000.000-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Sección 2: Sello Digital ── */}
      <section className="card-base">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
              <Award className="h-4 w-4 text-brand" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Sello Digital</h2>
          </div>
          <button
            onClick={() => setOrgSettings({ ...orgSettings, useCustomStamp: !orgSettings.useCustomStamp })}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-full border-2 transition-all text-[8px] font-black uppercase tracking-widest",
              orgSettings.useCustomStamp
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
            )}
          >
            <span>{orgSettings.useCustomStamp ? 'Personalizado' : 'Estándar'}</span>
            <div className={cn("h-2 w-2 rounded-full", orgSettings.useCustomStamp ? "bg-emerald-400" : "bg-slate-300")} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Controles */}
          <div className="space-y-5">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Estilo de Timbre</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'circular_double',     label: 'Doble'  },
                  { id: 'circular_horizontal', label: 'Línea'  },
                  { id: 'circular_dots',       label: 'Puntos' },
                  { id: 'oval',                label: 'Óvalo'  },
                  { id: 'square',              label: 'Cuadro' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setOrgSettings({ ...orgSettings, stampStyle: style.id as any })}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-xl border-2 transition-all",
                      orgSettings.stampStyle === style.id
                        ? "border-brand bg-indigo-50 text-brand"
                        : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 mb-1 border-2 rounded-sm",
                      style.id === 'circular_double'     && "rounded-full border-double",
                      style.id === 'circular_horizontal' && "rounded-full flex flex-col justify-center items-center",
                      style.id === 'circular_dots'       && "rounded-full border-dotted",
                      style.id === 'oval'                && "rounded-[100%] w-8",
                      style.id === 'square'              && "rounded-md"
                    )}>
                      {style.id === 'circular_horizontal' && <div className="w-full h-[1px] bg-current" />}
                    </div>
                    <span className="text-[6px] font-black uppercase">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {orgSettings.useCustomStamp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre en el Timbre</label>
                  <input
                    type="text"
                    value={orgSettings.customStampName}
                    onChange={(e) => setOrgSettings({ ...orgSettings, customStampName: e.target.value })}
                    className="input-base text-xs font-bold"
                    placeholder="Nombre para el timbre digital"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Lema (Motto)</label>
              <input
                type="text"
                value={orgSettings.lema}
                onChange={(e) => setOrgSettings({ ...orgSettings, lema: e.target.value })}
                className="input-base text-xs"
                placeholder="Excelencia en formación"
              />
            </div>
          </div>

          {/* Preview — más grande, junto a los controles */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center p-6 min-h-[220px]">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-4">Vista previa del timbre</span>
            <div className="w-52 h-52">
              <svg viewBox="0 0 200 200" className="w-full h-full text-brand/40">
                {orgSettings.stampStyle === 'square' ? (
                  <rect x="10" y="10" width="180" height="180" rx="15" fill="none" stroke="currentColor" strokeWidth="1.5" />
                ) : orgSettings.stampStyle === 'oval' ? (
                  <ellipse cx="100" cy="100" rx="95" ry="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
                ) : (
                  <>
                    <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeDasharray={orgSettings.stampStyle === 'circular_dots' ? "4 4" : "none"} />
                    {orgSettings.stampStyle === 'circular_double' && (
                      <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="1" />
                    )}
                    {orgSettings.stampStyle === 'circular_horizontal' && (
                      <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
                    )}
                  </>
                )}
                <defs>
                  <path id="sp-circleTop"    d="M 25,100 A 75,75 0 0,1 175,100" />
                  <path id="sp-circleBottom" d="M 25,100 A 75,75 0 0,0 175,100" />
                  <path id="sp-ovalTop"      d="M 25,100 A 75,55 0 0,1 175,100" />
                  <path id="sp-ovalBottom"   d="M 25,100 A 75,55 0 0,0 175,100" />
                </defs>
                <text className="fill-brand/60 font-black uppercase tracking-tight">
                  <textPath href={orgSettings.stampStyle === 'oval' ? "#sp-ovalTop" : "#sp-circleTop"} startOffset="50%" textAnchor="middle" fontSize="10">
                    {orgSettings.useCustomStamp ? (orgSettings.customStampName || 'Nombre Timbre') : (orgSettings.name || 'Institución')}
                  </textPath>
                </text>
                <text className="fill-brand/40 font-black uppercase tracking-widest">
                  <textPath href={orgSettings.stampStyle === 'oval' ? "#sp-ovalBottom" : "#sp-circleBottom"} startOffset="50%" textAnchor="middle" fontSize="8">
                    {orgSettings.lema || 'CERTIFICACIÓN DIGITAL'}
                  </textPath>
                </text>
                <text x="100" y={orgSettings.stampStyle === 'circular_horizontal' ? "90" : "105"}
                  textAnchor="middle" fontSize="10" className="fill-brand/70 font-black">
                  {orgSettings.stampStyle === 'circular_horizontal' ? 'FIRMA' : (orgSettings.rut || '76.XXX.XXX-X')}
                </text>
                {orgSettings.stampStyle === 'circular_horizontal' && (
                  <text x="100" y="115" textAnchor="middle" fontSize="8" className="fill-brand/40 font-bold">
                    {orgSettings.rut || '76.XXX.XXX-X'}
                  </text>
                )}
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── Guardar + aviso ── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
          <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
            Los cambios en identidad y sello afectarán los certificados generados a partir de este momento.
          </p>
        </div>
        <button
          onClick={handleOrgSave}
          disabled={showSavedMsg}
          className="btn-primary py-3 px-8 shrink-0 min-w-[180px] justify-center"
        >
          <AnimatePresence mode="wait">
            {showSavedMsg ? (
              <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Guardado</span>
              </motion.div>
            ) : (
              <motion.div key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center space-x-2">
                <Save className="h-4 w-4" />
                <span>Guardar cambios</span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ── Sección 3: Representantes Legales ── */}
      <section className="card-base">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-brand" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Representantes Legales</h2>
              <p className="text-[9px] text-slate-400 font-medium mt-0.5">Firmantes autorizados para los certificados</p>
            </div>
          </div>
          {!isAddingRep && (
            <button onClick={() => setIsAddingRep(true)} className="btn-primary flex items-center space-x-2 py-2 px-4">
              <Plus className="h-4 w-4" />
              <span>Agregar</span>
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Formulario de nuevo representante */}
          <AnimatePresence>
            {isAddingRep && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="border-2 border-brand/20 bg-indigo-50/30 rounded-2xl p-6 space-y-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre Completo</label>
                    <input type="text" value={newRep.name}
                      onChange={(e) => setNewRep({ ...newRep, name: e.target.value })}
                      className="input-base text-sm font-bold" placeholder="Juan Pérez Palma" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">RUT Personal</label>
                    <input type="text" value={newRep.rut}
                      onChange={(e) => setNewRep({ ...newRep, rut: e.target.value })}
                      className="input-base text-sm font-mono" placeholder="12.345.678-9" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Firma Autorizada</label>
                    <div className="flex bg-white rounded-lg p-0.5 shadow-sm border border-slate-200">
                      {(['draw', 'upload'] as const).map((type) => (
                        <button key={type} onClick={() => setSignatureType(type)}
                          className={cn("px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-md transition-all flex items-center space-x-1",
                            signatureType === type ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"
                          )}>
                          {type === 'draw' ? <><PenTool className="h-3 w-3" /><span>Dibujar</span></> : <><Upload className="h-3 w-3" /><span>Cargar</span></>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {signatureType === 'draw' ? (
                    <div className="relative group">
                      <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-inner group-hover:border-brand/30 transition-colors">
                        <SignatureCanvas ref={sigCanvas} penColor="#0f172a" canvasProps={{ className: "w-full h-36" }} />
                      </div>
                      <button onClick={handleClearSignature}
                        className="absolute bottom-3 right-3 h-9 w-9 bg-slate-50 border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl flex items-center justify-center transition-all shadow-sm"
                        title="Limpiar firma">
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
                              <button onClick={() => setNewRep({ ...newRep, signatureUrl: '' })}
                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-[8px] font-black uppercase text-brand tracking-widest">Firma cargada</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-7 w-7 text-slate-300 group-hover:text-brand transition-colors mb-2" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Click para cargar imagen</span>
                            <span className="text-[8px] text-slate-300 mt-1 font-medium">PNG transparente recomendado · Máx. 1.5 MB</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>

                <div className="flex space-x-3 pt-1">
                  <button onClick={() => setIsAddingRep(false)} className="btn-secondary flex-1 py-3">Cancelar</button>
                  <button onClick={handleSaveRep}
                    className="btn-primary flex-1 py-3 flex items-center justify-center space-x-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Guardar Representante</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lista de representantes */}
          {representatives.length === 0 && !isAddingRep ? (
            <div className="py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin representantes registrados</h3>
              <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Agrega el primer firmante autorizado para los certificados.</p>
              <button onClick={() => setIsAddingRep(true)}
                className="mt-5 btn-primary inline-flex items-center space-x-2 py-2.5 px-6">
                <Plus className="h-4 w-4" /><span>Agregar representante</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {representatives.map((rep) => (
                <motion.div key={rep.id} layout
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="group relative bg-white border border-slate-200 rounded-2xl hover:border-brand hover:shadow-lg hover:shadow-indigo-500/5 transition-all overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900 tracking-tight truncate">{rep.name}</h4>
                      <p className="text-[9px] font-mono text-slate-400 mt-0.5">{rep.rut}</p>
                    </div>
                    <button onClick={() => setDeletingId(rep.id!)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="h-24 bg-slate-50 flex items-center justify-center overflow-hidden">
                    <img src={rep.signatureUrl} alt={`Firma ${rep.name}`} className="h-full w-full object-contain p-3" />
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between bg-white">
                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Activo</span>
                    <span className="text-[8px] text-slate-400 font-mono">{new Date(rep.createdAt!).toLocaleDateString()}</span>
                  </div>

                  <AnimatePresence>
                    {deletingId === rep.id && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-white/97 backdrop-blur-sm flex flex-col items-center justify-center p-5 text-center rounded-2xl">
                        <AlertCircle className="h-7 w-7 text-red-500 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-1">¿Eliminar representante?</span>
                        <p className="text-[9px] text-slate-400 mb-4 leading-relaxed">Se eliminará la firma de forma permanente.</p>
                        <div className="flex space-x-2 w-full">
                          <button onClick={() => setDeletingId(null)}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors">
                            Cancelar
                          </button>
                          <button onClick={() => handleDeleteRep(rep.id!)}
                            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20">
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
      </section>
    </div>
  );
}

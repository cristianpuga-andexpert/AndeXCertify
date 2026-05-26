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
  X
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { OrganizationSettings, Representative } from '../types';
import { handleFirestoreError, OperationType, cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';

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
  const [newRep, setNewRep] = useState({
    name: '',
    rut: '',
    signatureUrl: '',
  });
  const [signatureType, setSignatureType] = useState<'draw' | 'upload'>('draw');
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        // Load Org Settings
        const settingsRef = doc(db, 'settings', user.uid);
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data() as OrganizationSettings;
          setOrgSettings({
            ...data,
            lema: data.lema || '',
            useCustomStamp: !!data.useCustomStamp,
            customStampName: data.customStampName || '',
            stampStyle: data.stampStyle || 'circular_double',
            logoUrl: data.logoUrl || '',
          });
        }

        // Load Representatives
        const repsRef = collection(db, 'settings', user.uid, 'representatives');
        const qReps = query(repsRef, orderBy('createdAt', 'desc'));
        const repsSnap = await getDocs(qReps);
        const repsData = repsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Representative));
        setRepresentatives(repsData);
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleOrgSave = async () => {
    if (!user) return;
    const path = `settings/${user.uid}`;
    
    const settingsData = {
      ...orgSettings,
      updatedAt: new Date().toISOString(),
    };

    // Check total document size (Firestore limit 1,048,576 bytes)
    const encoder = new TextEncoder();
    const totalBytes = encoder.encode(JSON.stringify(settingsData)).length;
    if (totalBytes > 1000000) { // 1MB limit with small buffer
      alert('Error de capacidad: El logo es demasiado grande y supera el límite de almacenamiento de Firestore (1MB). Por favor use un logo más liviano o comprimido.');
      return;
    }

    try {
      await setDoc(doc(db, 'settings', user.uid), settingsData);
      setShowSavedMsg(true);
      setTimeout(() => setShowSavedMsg(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    // Check size (Firestore limit 1MB)
    const encoder = new TextEncoder();
    const sizeInBytes = encoder.encode(signatureUrl).length;
    if (sizeInBytes > 800000) { // ~800KB limit for signature string to be safe
      alert('La firma es demasiado grande. Por favor intente con una imagen más pequeña o dibuje una firma más simple.');
      return;
    }

    const path = `settings/${user.uid}/representatives`;
    try {
      const repData = {
        name: newRep.name,
        rut: newRep.rut,
        signatureUrl,
        createdAt: new Date().toISOString(),
      };
      
      const docRef = await addDoc(collection(db, 'settings', user.uid, 'representatives'), repData);
      
      setRepresentatives([{ id: docRef.id, ...repData }, ...representatives]);
      setIsAddingRep(false);
      setNewRep({ name: '', rut: '', signatureUrl: '' });
      setSignatureType('draw');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleDeleteRep = async (id: string) => {
    if (!user) return;
    const path = `settings/${user.uid}/representatives/${id}`;
    try {
      await deleteDoc(doc(db, 'settings', user.uid, 'representatives', id));
      setRepresentatives(prev => prev.filter(r => r.id !== id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1500000) { // 1.5MB for signature
        alert('La imagen de la firma es demasiado grande (Máximo 1.5MB).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        let base64 = reader.result as string;
        
        // Auto-compress if needed for Firestore
        if (base64.length > 500000) {
          const img = new Image();
          img.src = base64;
          await new Promise(r => img.onload = r);
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
    if (file) {
      if (file.size > 2000000) { // 2MB
        alert('El logo es demasiado grande (Máximo 2MB). El sistema intentará comprimirlo automáticamente.');
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        let base64 = reader.result as string;
        
        // If it's too large for Firestore (approx > 800KB to be safe with base64 overhead)
        if (base64.length > 800000) {
          const img = new Image();
          img.src = base64;
          await new Promise(r => img.onload = r);
          
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension to ensure it fits in Firestore document
          const MAX_DIM = 800;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = (height * MAX_DIM) / width;
              width = MAX_DIM;
            } else {
              width = (width * MAX_DIM) / height;
              height = MAX_DIM;
            }
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
    }
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
    <div className="max-w-5xl mx-auto py-16 px-6">
      <header className="mb-12">
        <div className="flex items-center space-x-2 text-[10px] font-black text-brand uppercase tracking-[0.2em] mb-2 font-mono">
            <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse"></div>
            <span>Global Configuration Suite</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
          Configuración <span className="text-brand">Institucional</span>
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Org Settings */}
        <div className="lg:col-span-1 space-y-8">
          <section className="card-base p-8 space-y-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Building2 className="h-5 w-5 text-brand" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Identidad Corporativa</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col items-center mb-6">
                <label className="relative group cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoUpload}
                    className="hidden" 
                  />
                  <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden group-hover:border-brand group-hover:bg-indigo-50 transition-all">
                    {orgSettings.logoUrl ? (
                      <div className="relative h-full w-full group/logo">
                        <img src={orgSettings.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveLogo();
                          }}
                          className="absolute top-1 right-1 bg-white/90 text-red-500 p-1 rounded-lg opacity-0 group-hover/logo:opacity-100 transition-opacity shadow-sm hover:bg-red-50"
                          title="Eliminar logo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-slate-300 mb-1" />
                        <span className="text-[7px] font-black uppercase text-slate-400">Logo</span>
                      </>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-brand text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="h-3 w-3" />
                  </div>
                </label>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-4">Imagen Institucional (Logo)</span>
                <span className="text-[7px] text-slate-400 font-bold mt-1">Límite: 2MB (Auto-optimizado)</span>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre de la OTEC / Entidad</label>
                <input 
                  type="text" 
                  value={orgSettings.name}
                  onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                  className="input-base text-xs font-bold"
                  placeholder="Andexpert Solutions SpA"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">RUT Institucional</label>
                <input 
                  type="text" 
                  value={orgSettings.rut}
                  onChange={(e) => setOrgSettings({ ...orgSettings, rut: e.target.value })}
                  className="input-base text-xs font-mono"
                  placeholder="76.000.000-0"
                />
              </div>

              {/* Digital Stamp Section */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Configuración de Timbre</label>
                  <button 
                    onClick={() => setOrgSettings({ ...orgSettings, useCustomStamp: !orgSettings.useCustomStamp })}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-1 rounded-full border-2 transition-all",
                      orgSettings.useCustomStamp 
                        ? "bg-slate-900 border-slate-900 text-white" 
                        : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                    )}
                  >
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      {orgSettings.useCustomStamp ? 'Personalizado' : 'Estándar'}
                    </span>
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      orgSettings.useCustomStamp ? "bg-emerald-400" : "bg-slate-200"
                    )}></div>
                  </button>
                </div>

                <div className="space-y-4">
                  {orgSettings.useCustomStamp && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Dato Timbre (Nombre en Timbre)</label>
                      <input 
                        type="text" 
                        value={orgSettings.customStampName}
                        onChange={(e) => setOrgSettings({ ...orgSettings, customStampName: e.target.value })}
                        className="input-base text-xs font-bold"
                        placeholder="Nombre para el timbre digital"
                      />
                    </motion.div>
                  )}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estilo de Timbre</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { id: 'circular_double', label: 'Doble' },
                        { id: 'circular_horizontal', label: 'Línea' },
                        { id: 'circular_dots', label: 'Puntos' },
                        { id: 'oval', label: 'Óvalo' },
                        { id: 'square', label: 'Cuadro' }
                      ].map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setOrgSettings({ ...orgSettings, stampStyle: style.id as any })}
                          className={cn(
                            "flex flex-col items-center p-2 rounded-lg border-2 transition-all",
                            orgSettings.stampStyle === style.id 
                              ? "border-brand bg-indigo-50 text-brand" 
                              : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 mb-1 border-2 rounded-sm",
                            style.id === 'circular_double' && "rounded-full border-double",
                            style.id === 'circular_horizontal' && "rounded-full flex flex-col justify-center items-center h-6",
                            style.id === 'circular_dots' && "rounded-full border-dotted",
                            style.id === 'oval' && "rounded-[100%] w-8",
                            style.id === 'square' && "rounded-md"
                          )}>
                            {style.id === 'circular_horizontal' && <div className="w-full h-[1px] bg-current" />}
                          </div>
                          <span className="text-[6px] font-black uppercase">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Lema (Motto)</label>
                    <input 
                      type="text" 
                      value={orgSettings.lema}
                      onChange={(e) => setOrgSettings({ ...orgSettings, lema: e.target.value })}
                      className="input-base text-xs font-medium"
                      placeholder="Excelencia en formación"
                    />
                  </div>
                </div>

                {/* Stamp Preview */}
                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                   <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-3 block text-center">Vista Previa Timbrado</span>
                   <div className="flex flex-col items-center justify-center py-4 bg-white rounded-lg relative overflow-hidden">
                      <div className="w-48 h-48 relative">
                        <svg viewBox="0 0 200 200" className="w-full h-full text-brand/40">
                          {/* Main Shapes based on style */}
                          {orgSettings.stampStyle === 'square' ? (
                            <rect x="10" y="10" width="180" height="180" rx="15" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          ) : orgSettings.stampStyle === 'oval' ? (
                            <ellipse cx="100" cy="100" rx="95" ry="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          ) : (
                            <>
                              <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={orgSettings.stampStyle === 'circular_dots' ? "4 4" : "none"} />
                              {orgSettings.stampStyle === 'circular_double' && (
                                <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="1" />
                              )}
                              {orgSettings.stampStyle === 'circular_horizontal' && (
                                <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
                              )}
                            </>
                          )}
                          
                          {/* Curved Text Paths */}
                          <defs>
                            <path id="circlePathTop" d="M 25,100 A 75,75 0 0,1 175,100" />
                            <path id="circlePathBottom" d="M 25,100 A 75,75 0 0,0 175,100" />
                            <path id="ovalPathTop" d="M 25,100 A 75,55 0 0,1 175,100" />
                            <path id="ovalPathBottom" d="M 25,100 A 75,55 0 0,0 175,100" />
                          </defs>
 
                          {/* Top Text */}
                          <text className="fill-brand/60 text-[10px] font-black uppercase tracking-tight">
                            <textPath href={orgSettings.stampStyle === 'oval' ? "#ovalPathTop" : "#circlePathTop"} startOffset="50%" textAnchor="middle">
                              {orgSettings.useCustomStamp ? (orgSettings.customStampName || 'Nombre Timbre') : (orgSettings.name || 'Institución')}
                            </textPath>
                          </text>
 
                          {/* Bottom Text */}
                          <text className="fill-brand/40 text-[8px] font-black uppercase tracking-widest">
                            <textPath href={orgSettings.stampStyle === 'oval' ? "#ovalPathBottom" : "#circlePathBottom"} startOffset="50%" textAnchor="middle">
                              {orgSettings.lema || "CERTIFICACIÓN DIGITAL"}
                            </textPath>
                          </text>
 
                          {/* Center Text */}
                          <text x="100" y={orgSettings.stampStyle === 'circular_horizontal' ? "90" : "105"} textAnchor="middle" className="fill-brand/70 text-[10px] font-black">
                            {orgSettings.stampStyle === 'circular_horizontal' ? 'FIRMA' : (orgSettings.rut || '76.XXX.XXX-X')}
                          </text>
                          {orgSettings.stampStyle === 'circular_horizontal' && (
                            <text x="100" y="115" textAnchor="middle" className="fill-brand/40 text-[8px] font-bold">
                              {orgSettings.rut || '76.XXX.XXX-X'}
                            </text>
                          )}
                        </svg>
                      </div>
                   </div>
                </div>
              </div>

              <button 
                onClick={handleOrgSave}
                disabled={showSavedMsg}
                className="w-full btn-primary py-4 mt-2 group relative overflow-hidden"
              >
                <AnimatePresence mode="wait">
                  {showSavedMsg ? (
                    <motion.div 
                      key="saved"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="flex items-center justify-center space-x-2 w-full"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-[10px] uppercase font-black tracking-widest text-white">Datos guardados</span>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="save"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="flex items-center justify-center space-x-2 w-full"
                    >
                      <Save className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] uppercase font-black tracking-widest">Guardar datos</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </section>

          <div className="p-6 bg-slate-900 rounded-2xl flex flex-col items-center text-center">
            <AlertCircle className="h-6 w-6 text-emerald-400 mb-4" />
            <p className="text-[9px] text-white/50 font-bold uppercase tracking-widest leading-relaxed">
              Los cambios en la identidad corporativa afectarán a todos los certificados que se generen a partir de este momento.
            </p>
          </div>
        </div>

        {/* Right Column: Representatives */}
        <div className="lg:col-span-2 space-y-8">
          <section className="card-base p-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-brand" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Representantes Legales</h2>
              </div>
              
              {!isAddingRep && (
                <button 
                  onClick={() => setIsAddingRep(true)}
                  className="p-3 bg-brand text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <AnimatePresence>
                {isAddingRep && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-8 border-2 border-brand bg-slate-50/50 rounded-2xl mb-8 space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre Completo</label>
                        <input 
                          type="text" 
                          value={newRep.name}
                          onChange={(e) => setNewRep({ ...newRep, name: e.target.value })}
                          className="input-base text-xs font-bold"
                          placeholder="Juan Pérez Palma"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">RUT Personal</label>
                        <input 
                          type="text" 
                          value={newRep.rut}
                          onChange={(e) => setNewRep({ ...newRep, rut: e.target.value })}
                          className="input-base text-xs font-mono"
                          placeholder="12.345.678-9"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Firma Autorizada</label>
                        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                          <button 
                            onClick={() => setSignatureType('draw')}
                            className={cn(
                              "px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-md transition-all",
                              signatureType === 'draw' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            Dibujar
                          </button>
                          <button 
                            onClick={() => setSignatureType('upload')}
                            className={cn(
                              "px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-md transition-all",
                              signatureType === 'upload' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            Cargar
                          </button>
                        </div>
                      </div>

                      {signatureType === 'draw' ? (
                        <div className="relative group">
                          <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-inner group-hover:border-indigo-200 transition-colors">
                            <SignatureCanvas 
                              ref={sigCanvas}
                              penColor="#0f172a"
                              canvasProps={{ className: "w-full h-40" }}
                            />
                          </div>
                          <button 
                            onClick={handleClearSignature}
                            className="absolute bottom-4 right-4 h-10 w-10 bg-slate-50 border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl flex items-center justify-center transition-all shadow-sm"
                            title="Limpiar firma"
                          >
                            <Eraser className="h-5 w-5" />
                          </button>
                          <div className="absolute top-4 left-4 flex items-center space-x-2 text-slate-300 pointer-events-none uppercase font-black text-[10px] tracking-widest">
                            <PenTool className="h-3.5 w-3.5" />
                            <span>Área de captura digital</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <label className="relative block group">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleFileUpload}
                              className="hidden" 
                            />
                            <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl bg-white flex flex-col items-center justify-center group-hover:border-brand group-hover:bg-indigo-50 transition-all cursor-pointer">
                              {newRep.signatureUrl ? (
                                <div className="space-y-4 flex flex-col items-center">
                                  <div className="relative group/sig">
                                    <img src={newRep.signatureUrl} alt="Preview" className="h-24 object-contain" />
                                    <button 
                                      onClick={() => setNewRep({ ...newRep, signatureUrl: '' })}
                                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                      title="Quitar firma"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <span className="text-[8px] font-black uppercase text-brand">Firma cargada correctamente</span>
                                </div>
                              ) : (
                                <>
                                  <Upload className="h-8 w-8 text-slate-300 group-hover:text-brand transition-colors mb-3" />
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600">Click para cargar imagen</span>
                                  <span className="text-[8px] font-bold text-slate-300 mt-2">PNG transparente recomendado</span>
                                </>
                              )}
                            </div>
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-4 pt-2">
                       <button 
                        onClick={() => setIsAddingRep(false)}
                        className="flex-1 bg-white border border-slate-200 py-4 rounded-xl text-[10px] uppercase font-black text-slate-400 hover:bg-slate-50 transition-all tracking-widest"
                       >
                         Cancelar
                       </button>
                       <button 
                        onClick={handleSaveRep}
                        className="flex-1 bg-brand text-white py-4 rounded-xl text-[10px] uppercase font-black shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all tracking-widest flex items-center justify-center space-x-2"
                       >
                         <CheckCircle2 className="h-4 w-4" />
                         <span>Guardar Representante</span>
                       </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {representatives.length === 0 && !isAddingRep ? (
                  <div className="col-span-full py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Users className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay representantes registrados</h3>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Postule un nuevo administrador legal para este sistema.</p>
                  </div>
                ) : (
                  representatives.map((rep) => (
                    <motion.div 
                      key={rep.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative bg-white border border-slate-200 p-6 rounded-2xl hover:border-brand hover:shadow-xl hover:shadow-indigo-500/5 transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate max-w-[120px]">{rep.name}</h4>
                          <p className="text-[9px] font-mono text-slate-400 mt-1">{rep.rut}</p>
                        </div>
                        <button 
                          onClick={() => setDeletingId(rep.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors bg-white/50 md:bg-transparent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="h-20 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 overflow-hidden relative">
                         <img src={rep.signatureUrl} alt={`Firma ${rep.name}`} className="h-full w-full object-contain p-4" />
                         <div className="absolute top-2 right-2 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[7px] font-black uppercase text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Validada</span>
                         </div>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-300">
                        <span>Creado</span>
                        <span>{new Date(rep.createdAt).toLocaleDateString()}</span>
                      </div>

                      <AnimatePresence>
                        {deletingId === rep.id && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center"
                          >
                            <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-1">¿Está seguro que desea eliminar?</span>
                            <p className="text-[9px] font-bold text-slate-400 mb-6 px-4 leading-relaxed">Esta acción eliminará al representante y su firma de forma permanente.</p>
                            <div className="flex space-x-3 w-full">
                              <button 
                                onClick={() => setDeletingId(null)}
                                className="flex-1 py-3 px-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => handleDeleteRep(rep.id)}
                                className="flex-1 py-3 px-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 active:scale-95"
                              >
                                Eliminar
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CourseType, CourseStatus, QRDestination, CertificateTemplate as ITemplate } from '../types';
import { ChevronLeft, ChevronRight, CheckCircle2, Download, Info, Plus, FileText, Trash2, Upload } from 'lucide-react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/auth-context';

export function NewCourse() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<ITemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [formData, setFormData] = useState({
    nameReference: '',
    nameVisible: '',
    type: CourseType.HORIZONTAL,
    expirationDate: '',
    qrDestination: QRDestination.PDF,
    status: CourseStatus.ACTIVE,
    isSence: false,
    templateId: 'modern',
    customAssetUrl: '',
    senceData: {
      empresa: '',
      rutEmpresa: '',
      nombreCurso: '',
      codigoSence: '',
      fecInicio: '',
      fecTermino: '',
      fecVencimiento: '',
      horasActividad: 8,
      fecEmision: new Date().toISOString().split('T')[0],
    }
  });

  useEffect(() => {
    async function loadTemplates() {
      if (!user) return;
      setLoadingTemplates(true);
      try {
        const q = query(collection(db, 'templates'), where('createdBy', '==', user.uid));
        const snap = await getDocs(q);
        setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ITemplate)));
      } catch (err) {
        console.error("Error loading templates:", err);
      } finally {
        setLoadingTemplates(false);
      }
    }
    loadTemplates();
  }, [user]);

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB Limit for images to be safe in Firestore
        alert('La imagen es demasiado grande. Máximo 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, customAssetUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    const path = 'courses';
    try {
      await addDoc(collection(db, path), {
        ...formData,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const steps = [
    { id: 1, name: 'Datos Básicos' },
    { id: 2, name: 'Variables del Curso' },
    { id: 3, name: 'Diseño del Certificado' },
    { id: 4, name: 'Resumen' },
  ];
  return (
    <div className="max-w-4xl mx-auto py-16 px-6">
      <div className="mb-12">
        <div className="flex items-center space-x-2 text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-2">
            <div className="h-1 w-1 rounded-full bg-emerald-600"></div>
            <span>Secuencia de Nuevo Curso</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
          Inicializar <span className="text-brand">Entidad de Certificado</span>
        </h1>
      </div>
      
      {/* Stepper */}
      <div className="flex items-center justify-between mb-16 relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -z-10 -translate-y-1/2"></div>
        {steps.map((s) => (
          <div key={s.id} className="flex flex-col items-center">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center text-xs font-black transition-all shadow-sm border",
              step === s.id ? "bg-brand border-brand text-white ring-8 ring-emerald-50 scale-110" : 
              step > s.id ? "bg-emerald-100 border-emerald-200 text-emerald-700" : "bg-white text-slate-300 border-slate-200"
            )}>
              {step > s.id ? <CheckCircle2 className="h-5 w-5" /> : s.id.toString().padStart(2, '0')}
            </div>
            <span className={cn(
              "text-[9px] mt-3 font-black uppercase tracking-[0.2em]",
              step === s.id ? "text-slate-900" : "text-slate-400"
            )}>{s.name}</span>
          </div>
        ))}
      </div>

      <div className="card-base p-10 min-h-[500px] shadow-2xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="border-l-4 border-brand pl-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Configuración Principal</h2>
              <p className="text-slate-500 text-xs mt-1 font-medium">Defina la identidad fundamental de esta instancia de certificación.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tipo de Protocolo</label>
                <div className="flex space-x-4">
                  <button 
                    onClick={() => setFormData({...formData, isSence: true})}
                    className={cn(
                      "flex-1 p-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all",
                      formData.isSence ? "border-brand bg-emerald-50 text-brand shadow-sm" : "border-slate-100 text-slate-400 hover:border-slate-200"
                    )}
                  >
                    Con SENCE
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, isSence: false})}
                    className={cn(
                      "flex-1 p-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all",
                      !formData.isSence ? "border-brand bg-emerald-50 text-brand shadow-sm" : "border-slate-100 text-slate-400 hover:border-slate-200"
                    )}
                  >
                    Sin SENCE
                  </button>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">ID de Referencia del Sistema</label>
                <input 
                  type="text" 
                  value={formData.nameReference}
                  onChange={(e) => setFormData({...formData, nameReference: e.target.value})}
                  className="input-base text-lg font-bold"
                  placeholder="EX: INTERNAL_MEZZANINE_2024"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Título Visible de la Credencial</label>
                <input 
                  type="text" 
                  value={formData.nameVisible}
                  onChange={(e) => setFormData({...formData, nameVisible: e.target.value})}
                  className="input-base text-lg font-bold"
                  placeholder="EX: Diploma en Gestión Estratégica"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Dimensión del Diseño</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as CourseType})}
                  className="input-base font-bold appearance-none bg-slate-50"
                >
                  <option value={CourseType.HORIZONTAL}>Horizontal (A4)</option>
                  <option value={CourseType.VERTICAL}>Vertical (A4)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Expiración de Integridad</label>
                <input 
                  type="date" 
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({...formData, expirationDate: e.target.value})}
                  className="input-base font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Destino del QR</label>
                <select 
                  value={formData.qrDestination}
                  onChange={(e) => setFormData({...formData, qrDestination: e.target.value as QRDestination})}
                  className="input-base font-bold appearance-none bg-slate-50"
                >
                  <option value={QRDestination.PDF}>PDF</option>
                  <option value={QRDestination.VERIFICATION}>Página de verificación</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Estado</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as CourseStatus})}
                  className="input-base font-bold appearance-none bg-slate-50"
                >
                  <option value={CourseStatus.ACTIVE}>Activo</option>
                  <option value={CourseStatus.INACTIVE}>Inactivo</option>
                </select>
              </div>


            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="border-l-4 border-brand pl-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Variables del Curso</h2>
              <p className="text-slate-500 text-xs mt-1 font-medium">Defina los puntos de datos persistentes que se aplicarán a todos los certificados.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {[
                { label: 'NOMBRE_EMPRESA', key: 'empresa' },
                { label: 'RUT_EMPRESA', key: 'rutEmpresa' },
                { label: 'TITULO_CURSO', key: 'nombreCurso' },
                ...(formData.isSence ? [{ label: 'COD_SENCE', key: 'codigoSence' }] : []),
                { label: 'FECHA_INICIO', key: 'fecInicio', type: 'date' },
                { label: 'FECHA_TERMINO', key: 'fecTermino', type: 'date' },
                { label: 'FECHA_VENCIMIENTO', key: 'fecVencimiento', type: 'date' },
                { label: 'HORAS_TOTALES', key: 'horasActividad', type: 'number' },
                { label: 'FECHA_EMISION', key: 'fecEmision', type: 'date' },
              ].map((field) => (
                <div key={field.key}>
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">{field.label}</label>
                   <input 
                    type={field.type || 'text'}
                    value={(formData.senceData as any)[field.key]}
                    onChange={(e) => setFormData({
                      ...formData, 
                      senceData: { ...formData.senceData, [field.key]: e.target.value }
                    })}
                    className="input-base font-mono text-sm"
                   />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="border-l-4 border-brand pl-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Arquitectura Visual</h2>
              <p className="text-slate-500 text-xs mt-1 font-medium">Seleccione una estructura predefinida o cargue su propia referencia técnica.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
               {/* Fixed Templates */}
              {[
                { id: 'modern', name: 'Modern Premium', desc: 'SENCE Oficial / Estándar Chile' },
                { id: 'diploma', name: 'Diploma Arte', desc: 'Estética editorial para diplomas teal' },
                { id: 'classic', name: 'Elite Classic', desc: 'Estilo clásico para diplomas' },
                { id: 'tech', name: 'High-Tech Mono', desc: 'Estética técnica moderna' },
                { id: 'minimal', name: 'Pure Minimal', desc: 'Diseño ultra minimalista' },
              ].map((tpl) => (
                <button 
                  key={tpl.id}
                  onClick={() => setFormData({...formData, templateId: tpl.id})}
                  className={cn(
                    "p-6 rounded-2xl border-2 text-left transition-all relative overflow-hidden group",
                    formData.templateId === tpl.id 
                      ? "border-brand bg-emerald-50/50 ring-4 ring-emerald-50" 
                      : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                  )}
                >
                  <div className={cn(
                    "aspect-[1.41] mb-4 bg-slate-200 rounded-lg flex items-center justify-center p-4 border border-slate-300 shadow-inner group-hover:scale-[1.02] transition-transform",
                    formData.type === CourseType.VERTICAL ? "aspect-[0.70]" : "aspect-[1.41]"
                  )}>
                    <div className="text-[8px] font-black uppercase text-slate-400 tracking-widest text-center">Preview {tpl.name}</div>
                  </div>
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{tpl.name}</h3>
                  <p className="text-[9px] text-slate-500 mt-1 font-medium">{tpl.desc}</p>
                  
                  {formData.templateId === tpl.id && (
                    <div className="absolute top-4 right-4 bg-brand text-white p-1 rounded-full text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  )}
                </button>
              ))}

              {/* Dynamic Templates from Repository */}
              {templates.map((tpl) => (
                <button 
                  key={tpl.id}
                  onClick={() => setFormData({...formData, templateId: tpl.id})}
                  className={cn(
                    "p-6 rounded-2xl border-2 text-left transition-all relative overflow-hidden group",
                    formData.templateId === tpl.id 
                      ? "border-brand bg-emerald-50/50 ring-4 ring-emerald-50" 
                      : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                  )}
                >
                  <div className={cn(
                    "aspect-[1.41] mb-4 bg-brand/5 rounded-lg flex items-center justify-center p-4 border-2 border-dashed border-brand/20 shadow-inner group-hover:scale-[1.02] transition-transform",
                    formData.type === CourseType.VERTICAL ? "aspect-[0.70]" : "aspect-[1.41]"
                  )}>
                    <FileText className="h-8 w-8 text-brand/20" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate">{tpl.name}</h3>
                  <p className="text-[8px] text-slate-400 mt-1 font-bold uppercase">Plantilla Word (.docx)</p>
                  
                  {formData.templateId === tpl.id && (
                    <div className="absolute top-4 right-4 bg-brand text-white p-1 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}

              <div className="col-span-full mt-8">
                <div className="h-px bg-slate-100 w-full mb-8"></div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Mascara de Fondo y Multimedia</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Fondo de Certificado (Opcional)</label>
                    <label className="relative block group cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleAssetUpload}
                        className="hidden" 
                      />
                      <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white flex flex-col items-center justify-center group-hover:border-brand group-hover:bg-indigo-50 transition-all overflow-hidden relative">
                        {formData.customAssetUrl ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-white p-2">
                            <img src={formData.customAssetUrl} alt="Background" className="h-full w-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Plus className="h-8 w-8 text-white rotate-45" />
                              <span className="text-white text-[10px] font-black uppercase ml-2 text-shadow-sm">Cambiar Imagen</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-10 w-10 text-slate-200 group-hover:text-brand transition-colors mb-4" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 font-mono">Subir Máscara Base (PNG/JPG)</span>
                            <span className="text-[8px] font-bold text-slate-300 mt-2">Se usará como fondo del certificado</span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>

                  <div className="bg-slate-900 rounded-2xl p-8 flex flex-col justify-center border-l-8 border-brand">
                    <div className="flex items-center space-x-3 mb-4">
                      <Info className="h-5 w-5 text-emerald-400" />
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Protocolo de Previsualización</h4>
                    </div>
                    <p className="text-[9px] text-white/60 font-bold uppercase leading-relaxed mb-4">
                      Si carga una imagen de fondo, el sistema la proyectará detrás del contenido dinámico (QR, Nombre, Firmas). Ideal para certificados con diseño pre-impreso.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-8 bg-white/5 border border-white/10 rounded flex items-center justify-center text-[8px] font-mono text-emerald-500 font-black">PNG</div>
                      <div className="h-8 bg-white/5 border border-white/10 rounded flex items-center justify-center text-[8px] font-mono text-emerald-500 font-black">JPG</div>
                      <div className="h-8 bg-white/5 border border-white/10 rounded flex items-center justify-center text-[8px] font-mono text-emerald-500 font-black">SVG</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="border-l-4 border-brand pl-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight text-brand">Verificación Final de Integridad</h2>
              <p className="text-slate-500 text-xs mt-1 font-medium">Verifique el cumplimiento antes de confirmar en el registro seguro.</p>
            </div>

            <div className="bg-slate-900 p-10 rounded-2xl space-y-6">
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">ID Interno</span>
                 <span className="text-sm font-black text-white font-mono">{formData.nameReference}</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Título Visible</span>
                 <span className="text-lg font-black text-white tracking-tight">{formData.nameVisible}</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Tipo de Protocolo</span>
                 <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-white text-slate-900 rounded-md tracking-widest">{formData.isSence ? 'SENCE_REGULADO' : 'AUTH_PERSONALIZADA'}</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Diseño</span>
                 <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-white text-slate-900 rounded-md tracking-widest">{formData.templateId?.toUpperCase()}</span>
               </div>
               {formData.isSence && (
                 <div className="flex justify-between items-center border-b border-white/5 pb-4">
                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Código SENCE</span>
                   <span className="text-sm font-black text-white font-mono">{formData.senceData.codigoSence}</span>
                 </div>
               )}
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Destino QR</span>
                 <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-white text-slate-900 rounded-md tracking-widest">{formData.qrDestination === QRDestination.PDF ? 'PDF' : 'VERIFICACIÓN'}</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Estado</span>
                 <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-white text-slate-900 rounded-md tracking-widest">{formData.status === CourseStatus.ACTIVE ? 'ACTIVO' : 'INACTIVO'}</span>
               </div>
            </div>
          </motion.div>
        )}

        <div className="mt-16 flex justify-between items-center">
          <button 
            onClick={step === 1 ? () => navigate('/') : handlePrev}
            className="flex items-center space-x-2 text-slate-400 font-black hover:text-red-500 transition-all tracking-[0.2em] text-[10px] uppercase group"
          >
            <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span>{step === 1 ? 'Abortar' : 'Volver'}</span>
          </button>
          
          {step < 4 ? (
            <button 
              onClick={handleNext}
              className="btn-primary flex items-center space-x-3 py-5 px-10 group"
            >
              <span>Continuar</span>
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              className="btn-primary bg-brand flex items-center space-x-3 py-5 px-12 animate-pulse hover:animate-none group"
            >
              <span>Ejecutar Lanzamiento</span>
              <CheckCircle2 className="h-4 w-4 group-hover:scale-125 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

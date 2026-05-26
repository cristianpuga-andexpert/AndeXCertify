import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CourseType, CourseStatus, QRDestination, Course, CertificateTemplate as ITemplate } from '../types';
import { ChevronLeft, ChevronRight, CheckCircle2, Download, Plus, FileText, Upload, Info, Trash2 } from 'lucide-react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth-context';

export function EditCourse() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ITemplate[]>([]);
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
    async function loadData() {
      if (!courseId || !user) return;
      
      try {
        // Load templates
        const q = query(collection(db, 'templates'), where('createdBy', '==', user.uid));
        const tSnap = await getDocs(q);
        setTemplates(tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ITemplate)));

        // Load course
        const docRef = doc(db, 'courses', courseId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Course;
          setFormData({
            nameReference: data.nameReference || '',
            nameVisible: data.nameVisible || '',
            type: data.type || CourseType.HORIZONTAL,
            expirationDate: data.expirationDate || '',
            qrDestination: data.qrDestination || QRDestination.PDF,
            status: data.status || CourseStatus.ACTIVE,
            isSence: !!data.isSence,
            templateId: data.templateId || 'modern',
            customAssetUrl: data.customAssetUrl || '',
            senceData: data.senceData ? {
              empresa: data.senceData.empresa || '',
              rutEmpresa: data.senceData.rutEmpresa || '',
              nombreCurso: data.senceData.nombreCurso || '',
              codigoSence: data.senceData.codigoSence || '',
              fecInicio: data.senceData.fecInicio || '',
              fecTermino: data.senceData.fecTermino || '',
              fecVencimiento: data.senceData.fecVencimiento || '',
              horasActividad: data.senceData.horasActividad || 8,
              fecEmision: data.senceData.fecEmision || new Date().toISOString().split('T')[0],
            } : {
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
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [courseId, user]);

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
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
    if (!user || !courseId) return;
    const path = `courses/${courseId}`;
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        ...formData,
        updatedAt: new Date().toISOString(),
      });
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const steps = [
    { id: 1, name: 'Datos Básicos' },
    { id: 2, name: 'Variables del Curso' },
    { id: 3, name: 'Diseño del Certificado' },
    { id: 4, name: 'Resumen' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent"></div>
        <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Cargando Datos...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-6">
      <div className="mb-12">
        <div className="flex items-center space-x-2 text-[10px] font-bold text-brand uppercase tracking-[0.2em] mb-2">
            <div className="h-1 w-1 rounded-full bg-brand"></div>
            <span>Secuencia de Edición</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
          Editar <span className="text-brand">Curso</span>
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
              <p className="text-slate-500 text-xs mt-1 font-medium">Actualice la identidad fundamental de esta instancia de certificación.</p>
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
              <p className="text-slate-500 text-xs mt-1 font-mediumitalic">Defina los puntos de datos persistentes que se aplicarán a todos los certificados.</p>
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
              {[
                { id: 'modern', name: 'Modern Premium', desc: 'Minimalismo suizo con tipografía Inter' },
                { id: 'diploma', name: 'Diploma Arte', desc: 'Estilo artístico para diplomas' },
                { id: 'classic', name: 'Elite Classic', desc: 'Serif editorial para diplomas académicos' },
                { id: 'tech', name: 'High-Tech Mono', desc: 'Estética brutalista técnica' },
                { id: 'minimal', name: 'Pure Minimal', desc: 'Diseño enfocado en el contenido' },
                ...templates.map(t => ({ id: t.id!, name: t.name, desc: 'Plantilla Personalizada' }))
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
                    {tpl.desc === 'Plantilla Personalizada' ? (
                      <FileText className="h-8 w-8 text-slate-400" />
                    ) : (
                      <div className="text-[8px] font-black uppercase text-slate-400 tracking-widest text-center">Preview {tpl.name}</div>
                    )}
                  </div>
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{tpl.name}</h3>
                  <p className="text-[9px] text-slate-500 mt-1 font-medium italic">{tpl.desc}</p>
                  
                  {formData.templateId === tpl.id && (
                    <div className="absolute top-4 right-4 bg-brand text-white p-1 rounded-full">
                      <CheckCircle2 className="h-3 shadow-sm" />
                    </div>
                  )}
                </button>
              ))}

              <div className="col-span-full mt-8">
                <div className="h-px bg-slate-100 w-full mb-8"></div>
                
                <div className="flex items-center space-x-2 text-[10px] font-bold text-brand uppercase tracking-[0.2em] mb-6">
                  <Upload className="h-3 w-3" />
                  <span>Carga de Activos de Diseño (Mascaras o Fondos)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <label className="group p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center cursor-pointer hover:border-brand hover:bg-emerald-50 transition-all overflow-hidden min-h-[160px] justify-center">
                      <input type="file" className="hidden" accept="image/*" onChange={handleAssetUpload} />
                      {formData.customAssetUrl ? (
                         <div className="flex flex-col items-center">
                           <div className="h-20 w-32 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden mb-2">
                             <img src={formData.customAssetUrl} alt="Background" className="h-full w-full object-cover" />
                           </div>
                           <span className="text-[9px] font-black uppercase text-brand">Imagen Cargada</span>
                         </div>
                      ) : (
                        <>
                          <div className="h-12 w-12 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center mb-4 group-hover:-translate-y-1 transition-transform">
                            <Plus className="h-6 w-6 text-brand" />
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">Subir Imagen de Fondo</span>
                          <span className="text-[8px] font-bold text-slate-400 mt-1">PNG / JPG (MÁX 1MB)</span>
                        </>
                      )}
                    </label>
                    {formData.customAssetUrl && (
                      <button 
                        onClick={() => setFormData({...formData, customAssetUrl: ''})}
                        className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <div className="flex items-center space-x-2 text-[9px] font-black text-brand uppercase tracking-widest mb-3">
                       <Info className="h-3 w-3" />
                       <span>Información Técnica</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                      Si sube una imagen de fondo, esta se utilizará como base para el certificado. El sistema renderizará la firma, el timbre y el código QR sobre esta imagen en las posiciones predefinidas.
                    </p>
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
              <p className="text-slate-500 text-xs mt-1 font-medium">Verifique los cambios antes de guardar.</p>
            </div>

            <div className="bg-slate-900 p-10 rounded-2xl space-y-6">
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-brand uppercase tracking-widest">ID Interno</span>
                 <span className="text-sm font-black text-white font-mono">{formData.nameReference}</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-brand uppercase tracking-widest">Título Visible</span>
                 <span className="text-lg font-black text-white tracking-tight">{formData.nameVisible}</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-brand uppercase tracking-widest">Tipo de Protocolo</span>
                 <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-white text-slate-900 rounded-md tracking-widest">{formData.isSence ? 'SENCE_REGULADO' : 'AUTH_PERSONALIZADA'}</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-brand uppercase tracking-widest">Diseño</span>
                 <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-white text-slate-900 rounded-md tracking-widest">{formData.templateId?.toUpperCase()}</span>
               </div>
               {formData.isSence && (
                 <div className="flex justify-between items-center border-b border-white/5 pb-4">
                   <span className="text-[10px] font-black text-brand uppercase tracking-widest">Código SENCE</span>
                   <span className="text-sm font-black text-white font-mono">{formData.senceData.codigoSence}</span>
                 </div>
               )}
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-brand uppercase tracking-widest">Destino QR</span>
                 <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-white text-slate-900 rounded-md tracking-widest">{formData.qrDestination === QRDestination.PDF ? 'PDF' : 'VERIFICACIÓN'}</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] font-black text-brand uppercase tracking-widest">Estado</span>
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
            <span>{step === 1 ? 'Cancelar' : 'Volver'}</span>
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
              <span>Guardar Cambios</span>
              <CheckCircle2 className="h-4 w-4 group-hover:scale-125 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

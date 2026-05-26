import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Upload,
  FileText,
  FileStack,
  ShieldCheck
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc,
  query,
  orderBy,
  doc,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CertificateTemplate } from '../types';
import { handleFirestoreError, OperationType, cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { motion, AnimatePresence } from 'motion/react';
import LZString from 'lz-string';

export function Templates() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'sence' as 'sence' | 'non-sence',
    fileData: '',
    fileName: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const templatesRef = collection(db, 'templates');
        const qTemplates = query(
          templatesRef, 
          where('createdBy', '==', user.uid)
        );
        const templatesSnap = await getDocs(qTemplates);
        const templatesData = templatesSnap.docs
          .map(doc => {
            const data = doc.data() as CertificateTemplate;
            // Decompress if needed
            if (data.isCompressed && data.fileData) {
              try {
                const decompressed = LZString.decompressFromUTF16(data.fileData);
                if (decompressed) {
                  return { ...data, id: doc.id, fileData: decompressed };
                }
              } catch (e) {
                console.error("Error decompressing template:", e);
              }
            }
            return { id: doc.id, ...data };
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTemplates(templatesData);
      } catch (err: any) {
        console.error("Error loading templates:", err);
        setError("Error de permisos: Asegúrese de estar autenticado correctamente.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 2.5MB Limit Check for UI - Compression will try to fit this into Firestore's 1MB limit
      if (file.size > 2.5 * 1024 * 1024) {
        setFieldError('El archivo es demasiado grande (Máximo 2.5MB). El sistema intentará comprimirlo, pero archivos muy pesados excederán el límite de base de datos.');
        e.target.value = ''; // Reset input
        return;
      }

      setFieldError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTemplate({ 
          ...newTemplate, 
          fileData: reader.result as string,
          fileName: file.name 
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveTemplate = async () => {
    if (!user || !newTemplate.name || !newTemplate.fileData || isSaving) return;
    
    setFieldError(null);
    setIsSaving(true);
    const path = 'templates';
    try {
      // Try to compress fileData to save space in Firestore
      let finalFileData = newTemplate.fileData;
      let isCompressed = false;

      try {
        const compressed = LZString.compressToUTF16(newTemplate.fileData);
        // Only use compressed if it's actually smaller
        if (compressed.length < newTemplate.fileData.length) {
          finalFileData = compressed;
          isCompressed = true;
        }
      } catch (e) {
        console.warn("Compression failed, using raw data", e);
      }

      // STRICT FIRESTORE LIMIT VALIDATION (1MB)
      // Firestore counts total bytes in UTF-8. 
      const templateData = {
        name: newTemplate.name,
        type: newTemplate.type,
        fileData: finalFileData,
        fileName: newTemplate.fileName,
        isCompressed,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      };

      const encoder = new TextEncoder();
      const totalBytes = encoder.encode(JSON.stringify(templateData)).length;
      
      // Firestore limit is 1,048,576 bytes. We leave a small buffer for metadata/ID.
      if (totalBytes > 1040000) {
        const sizeInMB = (totalBytes / (1024 * 1024)).toFixed(2);
        setFieldError(`Error de Capacidad: Incluso con compresión, el documento pesa ${sizeInMB}MB. Por favor, optimice el archivo Word (elimine o comprima imágenes dentro del documento) para que pese menos de 1MB.`);
        setIsSaving(false);
        return;
      }
      
      const docRef = await addDoc(collection(db, 'templates'), templateData);
      
      // Store the decompressed version in state for UI display (if needed)
      setTemplates([{ ...templateData, id: docRef.id, fileData: newTemplate.fileData }, ...templates]);
      setSuccess('¡Plantilla registrada correctamente!');
      setIsAddingTemplate(false);
      setNewTemplate({ name: '', type: 'sence', fileData: '', fileName: '' });
      
      // Auto-hide success message after 4 seconds
      setTimeout(() => setSuccess(null), 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplateToDelete(id);
  };

  const executeDelete = async () => {
    if (!user || !templateToDelete || isDeleting) return;
    
    setIsDeleting(true);
    const path = `templates/${templateToDelete}`;
    try {
      await deleteDoc(doc(db, 'templates', templateToDelete));
      setTemplates(templates.filter(t => t.id !== templateToDelete));
      setTemplateToDelete(null);
      setSuccess('Plantilla eliminada');
      // Auto-hide success message
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent"></div>
        <span className="text-[10px] font-black text-brand uppercase tracking-widest text-center">Analizando Estructuras de Documentos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-16 px-6">
        <div className="bg-red-50 border-2 border-red-100 p-8 rounded-2xl text-center">
          <ShieldCheck className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-sm font-black text-red-900 uppercase tracking-widest mb-2">Error de Acceso</h2>
          <p className="text-xs text-red-600 font-bold mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary bg-red-600 hover:bg-red-700"
          >
            Reintentar Acceso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-16 px-6">
      <AnimatePresence>
        {templateToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center"
            >
              <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">¿Confirmar Eliminación?</h3>
              <p className="text-[11px] text-slate-500 font-bold mb-8 uppercase tracking-tight">
                ¿Está seguro que desea eliminar? Esta acción no se puede deshacer.
              </p>
              
              <div className="flex space-x-3">
                <button 
                  disabled={isDeleting}
                  onClick={() => setTemplateToDelete(null)}
                  className="flex-1 px-6 py-3 border-2 border-slate-100 rounded-xl text-[10px] uppercase font-black text-slate-400 hover:bg-slate-50 transition-all tracking-widest"
                >
                  No
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={executeDelete}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] uppercase font-black hover:bg-red-700 transition-all tracking-widest shadow-lg shadow-red-600/20 flex items-center justify-center"
                >
                  {isDeleting ? (
                    <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Sí, Eliminar"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="mb-12">
        <div className="flex items-center space-x-2 text-[10px] font-black text-brand uppercase tracking-[0.2em] mb-2 font-mono">
            <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse"></div>
            <span>Document Architecture Lab</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
          Gestión de <span className="text-brand">Plantillas</span>
        </h1>
      </header>

      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-[11px] font-black uppercase tracking-widest">{success}</span>
              </div>
              <button 
                onClick={() => setSuccess(null)}
                className="text-emerald-400 hover:text-emerald-600 transition-colors"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="card-base p-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <FileStack className="h-5 w-5 text-brand" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Repositorio de Formatos</h2>
          </div>
          
          {!isAddingTemplate && (
            <button 
              onClick={() => setIsAddingTemplate(true)}
              className="btn-primary py-3 px-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="text-[10px] uppercase font-black">Subir Nueva Plantilla</span>
            </button>
          )}
        </div>

        <AnimatePresence>
          {isAddingTemplate && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-8 border-2 border-brand bg-slate-50/50 rounded-2xl mb-12 space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Nombre Identificador</label>
                  <input 
                    type="text" 
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="input-base text-xs font-bold"
                    placeholder="Certificado SENCE 2024 - V1"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tipo de Aplicación</label>
                  <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button 
                      onClick={() => setNewTemplate({ ...newTemplate, type: 'sence' })}
                      className={cn(
                        "flex-1 px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded transition-all",
                        newTemplate.type === 'sence' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Con SENCE
                    </button>
                    <button 
                      onClick={() => setNewTemplate({ ...newTemplate, type: 'non-sence' })}
                      className={cn(
                        "flex-1 px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded transition-all",
                        newTemplate.type === 'non-sence' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Sin SENCE
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Cargar Formato Word (.docx)</label>
                <label className="relative block group">
                  <input 
                    type="file" 
                    accept=".docx" 
                    onChange={handleTemplateUpload}
                    className="hidden" 
                  />
                  <div className="py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white flex flex-col items-center justify-center group-hover:border-brand group-hover:bg-indigo-50 transition-all cursor-pointer">
                    {newTemplate.fileData ? (
                      <div className="flex flex-col items-center">
                        <div className="h-16 w-16 bg-brand text-white rounded-2xl mb-4 flex items-center justify-center shadow-xl shadow-indigo-500/20">
                          <FileText className="h-8 w-8" />
                        </div>
                        <span className="text-xs font-black uppercase text-slate-900">{newTemplate.fileName}</span>
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Documento Listo</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-slate-200 group-hover:text-brand transition-colors mb-4" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600">Click para seleccionar archivo</span>
                        <span className="text-[8px] font-bold text-slate-300 mt-2">Arrastre aquí su archivo con campos {"{{MARCADORES}}"}</span>
                      </>
                    )}
                  </div>
                </label>
                {fieldError && (
                  <p className="mt-2 text-[10px] font-bold text-red-500 uppercase tracking-widest">{fieldError}</p>
                )}
              </div>

              <div className="flex space-x-4 pt-4 border-t border-slate-100">
                <button 
                  disabled={isSaving}
                  onClick={() => setIsAddingTemplate(false)}
                  className="flex-1 bg-white border border-slate-200 py-4 rounded-xl text-[10px] uppercase font-black text-slate-400 hover:bg-slate-50 transition-all tracking-widest disabled:opacity-50"
                >
                  Descartar
                </button>
                <button 
                  disabled={isSaving}
                  onClick={handleSaveTemplate}
                  className="flex-1 btn-primary py-4 disabled:opacity-50 flex items-center justify-center"
                >
                  {isSaving ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      <span className="text-[10px] uppercase font-black tracking-widest">Registrar Plantilla</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          {templates.length === 0 && !isAddingTemplate ? (
            <div className="py-32 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <FileStack className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No hay arquitectura registrada</h3>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Inicie la carga de formatos para automatizar la emisión.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100">
                <div className="col-span-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identificador</div>
                <div className="col-span-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocolo</div>
                <div className="col-span-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Documento Origen</div>
                <div className="col-span-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Acciones</div>
              </div>
              <div className="divide-y divide-slate-50">
                {templates.map((template) => (
                  <motion.div 
                    key={template.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="col-span-4 flex items-center space-x-4">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                        template.type === 'sence' ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500"
                      )}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{template.name}</h4>
                    </div>

                    <div className="col-span-3">
                      <span className={cn(
                        "text-[8px] font-black uppercase px-2.5 py-1 rounded-full border",
                        template.type === 'sence' 
                          ? "bg-amber-50 text-amber-600 border-amber-100" 
                          : "bg-blue-50 text-blue-600 border-blue-100"
                      )}>
                        {template.type === 'sence' ? 'SENCE' : 'Estándar'}
                      </span>
                    </div>

                    <div className="col-span-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-600 truncate">{template.fileName}</span>
                        <span className="text-[8px] font-medium text-slate-400 mt-0.5">{new Date(template.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="col-span-2 text-right">
                      <button 
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mt-12 p-8 bg-slate-900 rounded-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Guía de Marcadores Digitales</h3>
          <p className="text-[10px] text-white/50 leading-relaxed font-bold uppercase tracking-tight mb-6">
            Su documento Word debe contener los siguientes marcadores de Reemplazo Automático para una sincronización exitosa:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              '{{EMPRESA_OTEC}}', 
              '{{RUT_EMPRESA_OTEC}}', 
              '{{NOMBRE_CURSO}}', 
              '{{NOMBRE_ALUMNO}}', 
              '{{RUT_ALUMNO}}',
              '{{EMPRESA_CLIENTE}}',
              '{{RUT_EMPRESA_CLIENTE}}',
              '{{EVALUACION}}',
              '{{ASISTENCIA}}',
              '{{FECHA_INICIO}}',
              '{{FECH_INI}}',
              '{{FECHA_TERMINO}}',
              '{{FECH_TER}}',
              '{{FECHA_EMISION}}',
              '{{FECHA_VENCIMIENTO}}',
              '{{FECH_VEN}}',
              '{{ID_CERTIFICADO}}',
              '{{ESTADO}}',
              '{{QR}}',
              '{{FIRMA}}',
              '{{FIRMA_OTEC}}',
              '{{REPRESENTANTE_NOMBRE}}',
              '{{REPRESENTANTE_RUT}}'
            ].map(tag => (
              <div key={tag} className="bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-[8px] font-mono text-brand font-black break-all">
                {tag}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
      </div>
    </div>
  );
}

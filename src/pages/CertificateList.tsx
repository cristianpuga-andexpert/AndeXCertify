import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Enrollment, Course, OrganizationSettings, Representative, CertificateTemplate as ITemplate, EnrollmentStatus } from '../types';
import { ArrowLeft, Download, UserCheck, Printer, Award, Loader2, AlertCircle, X, Terminal, Copy, Check } from 'lucide-react';
import { cn, handleFirestoreError, OperationType, formatRut } from '../lib/utils';
import { CertificateTemplate } from '../components/certificates/CertificateTemplate';
import { useAuth } from '../lib/auth-context';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import LZString from 'lz-string';
import JSZip from 'jszip';

export function CertificateList() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [customTemplateBlob, setCustomTemplateBlob] = useState<ArrayBuffer | null>(null);
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [previewStudent, setPreviewStudent] = useState<Enrollment | null>(null);
  const [previewMode, setPreviewMode] = useState<string>('modern');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [libreOfficeError, setLibreOfficeError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!courseId || !user) return;

    let unsubscribeEnrollments: (() => void) | undefined;

    const fetchData = async () => {
      try {
        // Load Course
        const docSnap = await getDoc(doc(db, 'courses', courseId));
        if (docSnap.exists()) {
          const data = docSnap.data() as Course;
          if (data.createdBy !== user.uid) {
            throw new Error('Sin permisos para este curso');
          }
          setCourse({ id: docSnap.id, ...data });
          
          const builtIn = ['modern', 'diploma', 'classic', 'tech', 'minimal'];
          if (data.templateId && !builtIn.includes(data.templateId)) {
            setPreviewMode('custom');
          } else {
            setPreviewMode(data.templateId || 'modern');
          }
        } else {
          return; // Course not found
        }

        // Load Org Settings
        const settingsSnap = await getDoc(doc(db, 'settings', user.uid));
        if (settingsSnap.exists()) {
          setSettings(settingsSnap.data() as OrganizationSettings);
        }

        // Load Representatives
        const repsRef = collection(db, 'settings', user.uid, 'representatives');
        const qReps = query(repsRef, orderBy('createdAt', 'desc'));
        const repsSnap = await getDocs(qReps);
        setRepresentatives(repsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Representative)));

        // Load Custom Template if needed
        const currentCourse = docSnap.data() as Course;
        const builtIn = ['modern', 'diploma', 'classic', 'tech', 'minimal'];
        
        // If the course uses a template, fetch its details (even if it's built-in, we might want the name/metadata if it's custom)
        if (currentCourse?.templateId && !builtIn.includes(currentCourse.templateId)) {
          const tDoc = await getDoc(doc(db, 'templates', currentCourse.templateId));
          if (tDoc.exists()) {
            const tData = tDoc.data() as ITemplate;
            setCustomTemplateName(tData.name);
            let fileBase64 = tData.fileData;
            
            if (tData.isCompressed) {
              fileBase64 = LZString.decompressFromUTF16(fileBase64) || '';
            }

            if (fileBase64) {
              const base64Data = fileBase64.split(',')[1];
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              setCustomTemplateBlob(bytes.buffer);
            }
          }
        }

      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `courses/${courseId}`);
      }

      const q = query(
        collection(db, 'enrollments'), 
        where('courseId', '==', courseId),
        where('createdBy', '==', user.uid)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment));
        setStudents(docs);
        if (docs.length > 0 && !previewStudent) {
          setPreviewStudent(docs[0]);
        }
        setLoading(false);
      }, (error) => {
        if (!auth.currentUser && error.message.includes('permission')) return;
        handleFirestoreError(error, OperationType.LIST, 'enrollments');
      });

      unsubscribeEnrollments = unsubscribe;
    };

    fetchData();

    return () => {
      if (unsubscribeEnrollments) unsubscribeEnrollments();
    };
  }, [courseId, user]);

  const toggleSelect = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportBatch = async () => {
    if (selectedStudents.length === 0 || !course || isExporting) return;
    
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      // DOCX Batch logic (kept as it works well)
      const selectedData = students.filter(s => selectedStudents.includes(s.id));
      
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Common data
      const tDoc = await getDoc(doc(db, 'templates', course.templateId));
      if (!tDoc.exists()) throw new Error('Plantilla no encontrada');
      const tData = tDoc.data() as ITemplate;
      let templateData = tData.fileData;
      if (tData.isCompressed) {
        templateData = LZString.decompressFromUTF16(templateData) || '';
      }

      const urlToBase64 = async (url: string): Promise<string> => {
        if (!url) return '';
        try {
          const response = await fetch(url, { mode: 'cors' });
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { return ''; }
      };

      const rawSignatureBase64 = currentRepresentative?.signatureUrl 
        ? await urlToBase64(currentRepresentative.signatureUrl)
        : '';

      const stampConfigForBatch = {
        useCustomStamp: settings?.useCustomStamp || false,
        customStampName: settings?.customStampName || '',
        lema: settings?.lema || '',
        orgName: settings?.name || 'OTEC',
        orgRut: settings?.rut || '',
        stampStyle: settings?.stampStyle || 'circular_double'
      };

      const docxBlobs: { blob: Blob; name: string }[] = [];

      for (let i = 0; i < selectedData.length; i++) {
        const student = selectedData[i];
        setExportProgress(Math.round(((i + 1) / selectedData.length) * 100));

        const markerData = {
          EMPRESA_OTEC: settings?.name || 'Laboralcap E.I.R.L',
          RUT_OTEC: settings?.rut || '76.058.374-K',
          RUT_EMPRESA_OTEC: settings?.rut || '76.058.374-K',
          NOMBRE_CURSO: course.nameVisible || course.senceData?.nombreCurso || '',
          NOMBRE_ALUMNO: student.studentName,
          RUT_ALUMNO: formatRut(student.studentRut),
          HORAS: course.senceData?.horasActividad?.toString() || '0',
          FECHA_INICIO: course.senceData?.fecInicio ? format(new Date(course.senceData.fecInicio), 'dd-MM-yyyy') : '',
          FECH_INI: course.senceData?.fecInicio ? format(new Date(course.senceData.fecInicio), 'dd-MM-yyyy') : '',
          FECHA_TERMINO: course.senceData?.fecTermino ? format(new Date(course.senceData.fecTermino), 'dd-MM-yyyy') : '',
          FECH_TER: course.senceData?.fecTermino ? format(new Date(course.senceData.fecTermino), 'dd-MM-yyyy') : '',
          FECHA_EMISION: course.senceData?.fecEmision ? format(new Date(course.senceData.fecEmision), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy'),
          FECH_EMI: course.senceData?.fecEmision ? format(new Date(course.senceData.fecEmision), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy'),
          FECHA_VENCIMIENTO: course.senceData?.fecVencimiento ? format(new Date(course.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
          FECH_VEN: course.senceData?.fecVencimiento ? format(new Date(course.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
          CODIGO_SENCE: course.senceData?.codigoSence || '',
          RAZON_SOCIAL_EMPRESA: course.senceData?.empresa || '',
          RUT_EMPRESA: course.senceData?.rutEmpresa || '',
          EMPRESA_CLIENTE: course.senceData?.empresa || '',
          RUT_EMPRESA_CLIENTE: course.senceData?.rutEmpresa || '',
          EVALUACION: student.evaluation || '6.5',
          ASISTENCIA: `${student.attendance || 100}%`,
          ESTADO: student.status,
          ID_CERTIFICADO: student.id,
          REPRESENTANTE_NOMBRE: currentRepresentative?.name || 'Alejandra Arce Núñez',
          REPRESENTANTE_RUT: currentRepresentative?.rut || '12.691.519-5',
          NOMBRE_RE_OTEC: currentRepresentative?.name || 'Alejandra Arce Núñez',
          RUT_RE_OTEC: currentRepresentative?.rut || '12.691.519-5',
          CONTENIDO_CURSO: course.description || '',
          DESCRIPCION_CURSO: course.description || '',
          QR: 'QR',
          FIRMA_OTEC: 'FIRMA_OTEC',
          FIRMA: 'FIRMA',
          TIMBRE: 'TIMBRE'
        };

        // QR Code Base64
        const qrElement = document.getElementById(`qr-hidden-${student.id}`);
        let qrBase64 = '';
        if (qrElement) {
           const svg = qrElement.querySelector('svg');
           if (svg) {
              const svgData = new XMLSerializer().serializeToString(svg);
              const canvas = document.createElement("canvas");
              canvas.width = 200;
              canvas.height = 200;
              const ctx = canvas.getContext("2d");
              const img = new Image();
              img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
              await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              });
              ctx?.drawImage(img, 0, 0, 200, 200);
              qrBase64 = canvas.toDataURL("image/png");
           }
        }

        const response = await fetch('/api/generate-certificate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateBase64: templateData,
            data: markerData,
            images: { 
              FIRMA: rawSignatureBase64, 
              FIRMA_OTEC: rawSignatureBase64,
              QR: qrBase64,
              TIMBRE: '' 
            },
            stampConfig: stampConfigForBatch
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          docxBlobs.push({ blob, name: student.studentName });
          zip.file(`Certificado_${student.studentName.replace(/\s+/g, '_')}.docx`, blob);
        }
      }

      if (docxBlobs.length === 1) {
        const url = URL.createObjectURL(docxBlobs[0].blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificado_${docxBlobs[0].name.replace(/\s+/g, '_')}_${course.nameVisible.replace(/\s+/g, '_')}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (docxBlobs.length > 1) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Lote_Certificados_${course.nameVisible.replace(/\s+/g, '_')}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      setIsExporting(false);
      setExportProgress(100);
    } catch (error) {
      console.error('Export error:', error);
      setIsExporting(false);
      alert('Hubo un error al generar los certificados.');
    }
  };

  const handleDownloadPDF = async (studentIds: string[]) => {
    console.log('PDF clicked', studentIds);
    if (studentIds.length === 0 || !course) return;
    if (isExporting) { setIsExporting(false); }
    
    setIsExporting(true);
    setExportProgress(10);

    let selectedData: typeof students = [];

    try {
      selectedData = students.filter(s => studentIds.includes(s.id));
      const tDoc = await getDoc(doc(db, 'templates', course.templateId));
      if (!tDoc.exists()) throw new Error('Plantilla no encontrada');
      const tData = tDoc.data() as ITemplate;
      let templateData = tData.fileData;
      if (tData.isCompressed) {
        templateData = LZString.decompressFromUTF16(templateData) || '';
      }

      const urlToBase64 = async (url: string): Promise<string> => {
        if (!url) return '';
        try {
          const response = await fetch(url, { mode: 'cors' });
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { return ''; }
      };

      const rawSignatureBase64 = currentRepresentative?.signatureUrl
        ? await urlToBase64(currentRepresentative.signatureUrl)
        : '';

      const stampConfigForBatch = {
        useCustomStamp: settings?.useCustomStamp || false,
        customStampName: settings?.customStampName || '',
        lema: settings?.lema || '',
        orgName: settings?.name || '',
        orgRut: settings?.rut || '',
      };

      setExportProgress(20);

      if (selectedData.length === 1) {
        // Single student: generate PDF directly
        const student = selectedData[0];
        const markerData: Record<string, string> = {
          EMPRESA_OTEC: settings?.name || '',
          RUT_OTEC: settings?.rut || '',
          RUT_EMPRESA_OTEC: settings?.rut || '',
          NOMBRE_CURSO: course.nameVisible || '',
          NOMBRE_ALUMNO: student.studentName,
          RUT_ALUMNO: student.studentRut,
          HORAS: course.senceData?.horasActividad?.toString() || '0',
          FECHA_INICIO: course.senceData?.fecInicio ? format(new Date(course.senceData.fecInicio), 'dd-MM-yyyy') : '',
          FECH_INI: course.senceData?.fecInicio ? format(new Date(course.senceData.fecInicio), 'dd-MM-yyyy') : '',
          FECHA_TERMINO: course.senceData?.fecTermino ? format(new Date(course.senceData.fecTermino), 'dd-MM-yyyy') : '',
          FECH_TER: course.senceData?.fecTermino ? format(new Date(course.senceData.fecTermino), 'dd-MM-yyyy') : '',
          FECHA_EMISION: format(new Date(), 'dd-MM-yyyy'),
          FECH_EMI: format(new Date(), 'dd-MM-yyyy'),
          FECHA_VENCIMIENTO: course.senceData?.fecVencimiento ? format(new Date(course.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
          FECH_VEN: course.senceData?.fecVencimiento ? format(new Date(course.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
          CODIGO_SENCE: course.senceData?.codigoSence || '',
          EMPRESA_CLIENTE: course.senceData?.empresa || '',
          RUT_EMPRESA_CLIENTE: course.senceData?.rutEmpresa || '',
          EVALUACION: student.evaluation || '',
          ASISTENCIA: `${student.attendance || 100}%`,
          ESTADO: student.status,
          ID_CERTIFICADO: student.id,
          NOMBRE_RE_OTEC: currentRepresentative?.name || '',
          RUT_RE_OTEC: currentRepresentative?.rut || '',
          CONTENIDO_CURSO: course.description || '',
          QR: 'QR', FIRMA_OTEC: 'FIRMA_OTEC', FIRMA: 'FIRMA', TIMBRE: 'TIMBRE'
        };

        let qrBase64 = '';
        const qrEl = document.getElementById(`qr-hidden-${student.id}`);
        if (qrEl) {
          const svg = qrEl.querySelector('svg');
          if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            canvas.width = 200; canvas.height = 200;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            await new Promise(r => { img.onload = r; img.onerror = r; });
            ctx?.drawImage(img, 0, 0, 200, 200);
            qrBase64 = canvas.toDataURL('image/png');
          }
        }

        setExportProgress(50);

        const response = await fetch('/api/generate-certificate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateBase64: templateData,
            data: markerData,
            images: { FIRMA: rawSignatureBase64, FIRMA_OTEC: rawSignatureBase64, QR: qrBase64, TIMBRE: '' },
            stampConfig: stampConfigForBatch
          })
        });

        if (!response.ok) {
          const rawText = await response.text();
          let parsedError = rawText;
          try {
            const parsed = JSON.parse(rawText);
            parsedError = parsed.details || parsed.error || rawText;
          } catch {}
          throw new Error(parsedError);
        }
        const blob = await response.blob();
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const studentName = student.studentName.replace(/\s+/g, '_');
        const courseName = (course.nameVisible || '').replace(/\s+/g, '_');
        a.download = `Certificado_${studentName}_${courseName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExportProgress(100);
      } else {
        // Multiple students: generate a PDF each & zip them
        const zip = new JSZip();

        for (let i = 0; i < selectedData.length; i++) {
          const student = selectedData[i];
          setExportProgress(20 + Math.round((i / selectedData.length) * 70));

          const markerData: Record<string, string> = {
            EMPRESA_OTEC: settings?.name || '',
            RUT_OTEC: settings?.rut || '',
            RUT_EMPRESA_OTEC: settings?.rut || '',
            NOMBRE_CURSO: course.nameVisible || '',
            NOMBRE_ALUMNO: student.studentName,
            RUT_ALUMNO: student.studentRut,
            HORAS: course.senceData?.horasActividad?.toString() || '0',
            FECHA_INICIO: course.senceData?.fecInicio ? format(new Date(course.senceData.fecInicio), 'dd-MM-yyyy') : '',
            FECH_INI: course.senceData?.fecInicio ? format(new Date(course.senceData.fecInicio), 'dd-MM-yyyy') : '',
            FECHA_TERMINO: course.senceData?.fecTermino ? format(new Date(course.senceData.fecTermino), 'dd-MM-yyyy') : '',
            FECH_TER: course.senceData?.fecTermino ? format(new Date(course.senceData.fecTermino), 'dd-MM-yyyy') : '',
            FECHA_EMISION: format(new Date(), 'dd-MM-yyyy'),
            FECH_EMI: format(new Date(), 'dd-MM-yyyy'),
            FECHA_VENCIMIENTO: course.senceData?.fecVencimiento ? format(new Date(course.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
            FECH_VEN: course.senceData?.fecVencimiento ? format(new Date(course.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
            CODIGO_SENCE: course.senceData?.codigoSence || '',
            EMPRESA_CLIENTE: course.senceData?.empresa || '',
            RUT_EMPRESA_CLIENTE: course.senceData?.rutEmpresa || '',
            EVALUACION: student.evaluation || '',
            ASISTENCIA: `${student.attendance || 100}%`,
            ESTADO: student.status,
            ID_CERTIFICADO: student.id,
            NOMBRE_RE_OTEC: currentRepresentative?.name || '',
            RUT_RE_OTEC: currentRepresentative?.rut || '',
            CONTENIDO_CURSO: course.description || '',
            QR: 'QR', FIRMA_OTEC: 'FIRMA_OTEC', FIRMA: 'FIRMA', TIMBRE: 'TIMBRE'
          };

          let qrBase64 = '';
          const qrEl = document.getElementById(`qr-hidden-${student.id}`);
          if (qrEl) {
            const svg = qrEl.querySelector('svg');
            if (svg) {
              const svgData = new XMLSerializer().serializeToString(svg);
              const canvas = document.createElement('canvas');
              canvas.width = 200; canvas.height = 200;
              const ctx = canvas.getContext('2d');
              const img = new Image();
              img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
              await new Promise(r => { img.onload = r; img.onerror = r; });
              ctx?.drawImage(img, 0, 0, 200, 200);
              qrBase64 = canvas.toDataURL('image/png');
            }
          }

          const response = await fetch('/api/generate-certificate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateBase64: templateData,
              data: markerData,
              images: { FIRMA: rawSignatureBase64, FIRMA_OTEC: rawSignatureBase64, QR: qrBase64, TIMBRE: '' },
              stampConfig: stampConfigForBatch
            })
          });

          if (!response.ok) {
            const rawText = await response.text();
            let parsedError = rawText;
            try {
              const parsed = JSON.parse(rawText);
              parsedError = parsed.details || parsed.error || rawText;
            } catch {}
            throw new Error(parsedError);
          }
          const pdfBlob = await response.blob();
          const studentName = student.studentName.replace(/\s+/g,'_');
          const courseName = (course.nameVisible||'').replace(/\s+/g,'_');
          zip.file(`Certificado_${studentName}_${courseName}.pdf`, pdfBlob);
        }

        setExportProgress(90);

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificados_${(course.nameVisible||'Lote').replace(/\s+/g,'_')}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExportProgress(100);
      }

    } catch (err: any) {
      console.error('PDF generation error:', err);
      if (err?.message?.includes('LibreOffice') || err?.message?.includes('libreoffice')) {
        setLibreOfficeError(err.message);
      } else {
        alert('Error al generar PDF: ' + (err?.message || String(err)));
      }
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const currentRepresentative = representatives[0] || null;

  if (loading) {
     return (
       <div className="h-screen flex items-center justify-center">
         <Loader2 className="h-12 w-12 text-brand animate-spin" />
       </div>
     );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-6">
      <div className="no-print">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-8">
          <div className="flex items-start space-x-6">
            <Link to="/" className="mt-2 h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-all shadow-sm group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div>
              <div className="flex items-center space-x-2 text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-2">
                <div className="h-1 w-1 rounded-full bg-emerald-600"></div>
                <span>Centro de Emisión</span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                Gestión de <span className="text-brand">Certificados</span>
              </h1>
              <p className="text-slate-500 mt-2 font-medium text-xs uppercase tracking-widest opacity-60">Curso: <span className="text-slate-900 font-bold">{course?.nameVisible}</span></p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
             <div className="flex bg-slate-100 rounded-xl p-1.5 border border-slate-200">
              {/* Only show SENCE if no custom template is uploaded, per user request to prioritize uploaded/diploma */}
              {!customTemplateBlob && (
                <button 
                  onClick={() => setPreviewMode('modern')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    previewMode === 'modern' ? "bg-white shadow-md text-brand" : "text-slate-500"
                  )}
                >
                  SENCE
                </button>
              )}
              <button 
                onClick={() => setPreviewMode('diploma')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                  previewMode === 'diploma' ? "bg-white shadow-md text-brand" : "text-slate-500"
                )}
              >
                Diploma
              </button>
              {customTemplateBlob && (
                <button 
                  onClick={() => setPreviewMode('custom')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    previewMode === 'custom' ? "bg-white shadow-md text-brand" : "text-slate-500"
                  )}
                >
                  {customTemplateName || 'Plantilla Cargada'}
                </button>
              )}
            </div>

            <button 
              onClick={() => handleDownloadPDF(selectedStudents)}
              disabled={selectedStudents.length === 0 || isExporting}
              className="btn-primary flex items-center space-x-2 py-3 px-6 shadow-brand/20 disabled:opacity-50 min-w-[140px] justify-center bg-emerald-600 border-emerald-600 hover:bg-emerald-700"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Award className="h-4 w-4" />
              )}
              <span className="text-[10px] uppercase font-black tracking-widest">
                {isExporting ? 'Exportando...' : `Descargar PDF (${selectedStudents.length})`}
              </span>
            </button>
            <button 
              onClick={handleExportBatch}
              disabled={selectedStudents.length === 0 || isExporting}
              className="btn-primary flex items-center space-x-2 py-3 px-6 shadow-brand/20 disabled:opacity-50 min-w-[140px] justify-center"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="text-[10px] uppercase font-black tracking-widest">
                {isExporting ? 'Exportando...' : `Descargar Word (${selectedStudents.length})`}
              </span>
            </button>
            <button 
              onClick={handlePrint}
              disabled={selectedStudents.length === 0}
              className="btn-secondary flex items-center space-x-2 py-3 px-6 shadow-sm disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span className="text-[10px] uppercase font-black tracking-widest">Imprimir</span>
            </button>
          </div>
        </div>

        <div className="card-base border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col bg-white">
          <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
             <div className="flex items-center space-x-4">
                <input 
                  type="checkbox" 
                  checked={selectedStudents.length === students.length && students.length > 0}
                  onChange={selectAll}
                  className="h-5 w-5 text-brand focus:ring-brand rounded border-slate-300"
                />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Seleccionar Todos los Participantes</h3>
             </div>
             <div className="flex items-center space-x-4">
                <span className="bg-brand/10 text-brand text-[10px] font-black px-3 py-1 transparent-bg rounded-full uppercase tracking-tighter">
                  {selectedStudents.length} Seleccionados
                </span>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{students.length} Total</span>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-slate-100">
            {students.length === 0 ? (
              <div className="col-span-full py-24 text-center">
                 <Award className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No hay alumnos inscritos en este curso</p>
              </div>
            ) : (
              students.map((student) => (
                <div 
                  key={student.id} 
                  className={cn(
                    "p-6 cursor-pointer transition-all flex items-center space-x-4 group",
                    selectedStudents.includes(student.id) ? "bg-emerald-50/30 font-bold" : "hover:bg-slate-50"
                  )}
                  onClick={() => toggleSelect(student.id)}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedStudents.includes(student.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(student.id); }}
                    className="h-6 w-6 text-brand focus:ring-brand rounded-lg border-slate-300 transition-all shadow-sm"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-black tracking-tight text-slate-900 group-hover:text-brand transition-colors">
                      {student.studentName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formatRut(student.studentRut)}</div>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter",
                    student.status === EnrollmentStatus.APROBADO ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {student.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Rendering area for Export/Print - Only visible for generation/printing */}
      {/* Hidden QR Codes and Rendering Containers */}
      <div className="hidden">
        {students.map(s => (
          <div key={`qr-cont-${s.id}`} id={`qr-hidden-${s.id}`}>
            <QRCodeSVG 
              value={`${window.location.origin}/validar/${s.id}`} 
              size={200} 
              level="H" 
            />
          </div>
        ))}
      {/* Off-screen renderer for batch rendering to avoid display:none issues with html2canvas */}
      <div id="docx-render-hidden" style={{ opacity: 0, pointerEvents: 'none', position: 'absolute', top: -9999, width: '210mm', minHeight: '297mm' }} />
      </div>

      {isExporting && (
        <div className="fixed -left-[4000px] top-0 pointer-events-none bg-white">
          <div id={`cert-export-container`}>
             {students.filter(s => previewStudent?.id === s.id).map(s => (
                <CertificateTemplate 
                  key={s.id}
                  course={course!} 
                  enrollment={s} 
                  settings={settings}
                  representative={currentRepresentative}
                  templateId={previewMode} 
                  templateBlob={customTemplateBlob}
                />
             ))}
          </div>
        </div>
      )}

      {/* Print View Layout */}
      <div className="hidden print:block">
        {students.filter(s => selectedStudents.includes(s.id)).map((s, idx) => (
          <div key={s.id} className={idx > 0 ? "page-break-before" : ""}>
            <CertificateTemplate 
              course={course!} 
              enrollment={s} 
              settings={settings}
              representative={currentRepresentative}
              templateId={previewMode} 
              templateBlob={customTemplateBlob}
            />
          </div>
        ))}
      </div>

      {/* LibreOffice Instruction Modal */}
      {libreOfficeError && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-2xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div className="flex items-center space-x-4">
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100">
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Entorno de Producción Requerido</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Generación de PDF con Alta Fidelidad (LibreOffice)</p>
                </div>
              </div>
              <button 
                onClick={() => setLibreOfficeError(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-xl transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              <p className="text-slate-600 text-sm leading-relaxed">
                Has configurado el sistema para generar tus certificados PDF con la máxima fidelidad posible utilizando el motor nativo de LibreOffice headless (DOCX → PDF). No obstante, este binario requiere privilegios de sistema operativo para su instalación.
              </p>

              {/* Diagnostics / Server Error code block */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-rose-700 text-xs font-black uppercase tracking-wider">
                  <Terminal className="h-4 w-4" />
                  <span>Detalle del Error del Servidor</span>
                </div>
                <p className="text-xs font-mono text-rose-800 bg-rose-50 p-3 rounded-lg overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
                  {libreOfficeError}
                </p>
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold ring-1 ring-indigo-100">1</span>
                  <span>Instalación en la VPS / Servidor de Producción</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed pl-7">
                  Para solucionar este error en tu servidor Ubuntu o Debian, instala los paquetes oficiales de LibreOffice ejecutando los siguientes comandos:
                </p>
                <div className="bg-slate-900 rounded-xl p-4 pl-7 font-mono text-[11px] text-emerald-400 relative group">
                  <pre className="overflow-x-auto select-all">
{`sudo apt update
sudo apt install -y libreoffice`}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("sudo apt update && sudo apt install -y libreoffice");
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    }}
                    className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedText ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold ring-1 ring-indigo-100">2</span>
                  <span>Entornos Serverless / Contenedores</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed pl-7">
                  Si estás desplegando en plataformas como <strong>Google AI Studio, Vercel, Firebase Hosting o Netlify</strong>, los binarios del sistema no están disponibles por defecto. Debes desplegar la aplicación en:
                </p>
                <ul className="list-disc pl-12 text-xs text-slate-600 space-y-1">
                  <li><strong>Docker (Cloud Run, AWS ECS, GCP)</strong>: Utilizando una imagen base que preinstale LibreOffice.</li>
                  <li><strong>SaaS Dedicados (Render, VPS, DigitalOcean, Railway)</strong>: Configurando un buildpack o Dockerfile que incluya <code className="bg-slate-100 px-1 py-0.5 rounded">libreoffice</code>.</li>
                </ul>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setLibreOfficeError(null)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-800/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-docx-content {
          font-family: 'Inter', 'Arial', sans-serif;
          line-height: 1.15;
          font-size: 10.5px;
          color: #000;
        }
        .custom-docx-content p {
          margin-bottom: 0.1em;
          min-height: 1em;
        }
        .custom-docx-content table {
          border-collapse: collapse;
          width: 100% !important;
          margin: 0.5em 0;
          table-layout: fixed;
          border: 1px solid #000;
        }
        .custom-docx-content table td, .custom-docx-content table th {
          padding: 2px 5px;
          vertical-align: middle;
          border: 1px solid #000;
          word-wrap: break-word;
          overflow: hidden;
        }
        .custom-docx-content h1, .custom-docx-content h2, .custom-docx-content h3 {
          font-weight: 800;
          margin-top: 0.6em;
          margin-bottom: 0.2em;
          line-height: 1.1;
          color: #1e3a8a;
          page-break-after: avoid;
        }
        .custom-docx-content h1 { font-size: 16px; text-transform: uppercase; text-align: center; }
        .custom-docx-content h2 { font-size: 13.5px; }
        .custom-docx-content h3 { font-size: 12px; }
        
        .custom-docx-content img {
          max-width: 100%;
          height: auto;
          display: inline-block;
        }
        
        .custom-docx-content strong, .custom-docx-content b {
          font-weight: 700;
        }
        .custom-docx-content em, .custom-docx-content i {
          font-style: italic;
        }
        .custom-docx-content ul {
          list-style-type: disc;
          padding-left: 2.5em;
          margin-bottom: 1em;
        }
        .custom-docx-content ol {
          list-style-type: decimal;
          padding-left: 2.5em;
          margin-bottom: 1em;
        }
        .qr-placeholder svg {
          display: block;
          margin: 0 auto;
        }
        .no-print {
          display: block;
        }
        @media screen {
          .printable-area {
            /* Basic resets for capture */
            --tw-bg-opacity: 1 !important;
            --tw-text-opacity: 1 !important;
            --tw-border-opacity: 1 !important;
          }
        }
        @media print {
          body > * { display: none !important; }
          body > #pdf-print-wrapper { 
            display: block !important;
            position: static !important;
            width: 100% !important;
          }
          @page { 
            size: A4 portrait; 
            margin: 10mm; 
          }
        }
      `}</style>
      <div 
        id="pdf-print-container" 
        style={{ display: 'none' }}
        dangerouslySetInnerHTML={{ __html: '' }}
      />
    </div>
  );
}


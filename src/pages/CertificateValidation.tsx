import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Enrollment, Course, OrganizationSettings, Representative, CertificateTemplate as ITemplate } from '../types';
import { CheckCircle2, Award, Calendar, User, FileCheck, XCircle, Info, Download, Loader2, AlertCircle, X, Terminal, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatRut, handleFirestoreError, OperationType, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import LZString from 'lz-string';

export function CertificateValidation() {
  const { certificateId } = useParams();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [libreOfficeError, setLibreOfficeError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!certificateId) {
        setErrorStatus('ID de certificado no proporcionado');
        setLoading(false);
        return;
      }
      
      console.log("🔍 Validating certificate:", certificateId);
      
      try {
        const enrollSnap = await getDoc(doc(db, 'enrollments', certificateId));
        if (enrollSnap.exists()) {
          const enrollData = { id: enrollSnap.id, ...enrollSnap.data() } as Enrollment;
          setEnrollment(enrollData);
          console.log("✅ Enrollment found:", enrollData.studentName);
          
          // Get Course
          if (enrollData.courseId) {
            const courseSnap = await getDoc(doc(db, 'courses', enrollData.courseId));
            if (courseSnap.exists()) {
              const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
              setCourse(courseData);
              console.log("✅ Course found:", courseData.nameVisible);

              // Get Settings from course creator
              if (courseData.createdBy) {
                const settingsSnap = await getDoc(doc(db, 'settings', courseData.createdBy));
                if (settingsSnap.exists()) {
                  setSettings(settingsSnap.data() as OrganizationSettings);
                }

                // Get Representatives
                try {
                  const repsRef = collection(db, 'settings', courseData.createdBy, 'representatives');
                  const qReps = query(repsRef, orderBy('createdAt', 'desc'));
                  const repsSnap = await getDocs(qReps);
                  setRepresentatives(repsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Representative)));
                } catch (repErr) {
                  console.error("Error fetching representatives:", repErr);
                }
              }
            } else {
              console.error("❌ Course not found:", enrollData.courseId);
              setErrorStatus('Curso asociado no encontrado');
            }
          } else {
            setErrorStatus('Datos de curso faltantes en inscripción');
          }
        } else {
          console.error("❌ Enrollment not found:", certificateId);
          setErrorStatus('Certificado no encontrado en nuestros registros');
        }
      } catch (err) {
        console.error("❌ Verification Error:", err);
        setErrorStatus('Error al conectar con el servicio de verificación');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [certificateId]);

  const handleDownload = async (asPdf: boolean = false) => {
    if (!enrollment || !course || !settings || isDownloading) return;
    
    setIsDownloading(true);
    try {
      const currentRepresentative = representatives[0] || null;
      
      // Helper to convert URL to Base64
      const urlToBase64 = async (url: string): Promise<string> => {
        if (!url) return '';
        if (url.startsWith('data:image/png')) return url;
        try {
          const response = await fetch(url, { mode: 'cors' });
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error("Error converting URL to base64:", e);
          return '';
        }
      };

      /**
       * Genera imagen compuesta: firma PNG + sello circular semitransparente superpuesto.
       */
      const compositeSignatureWithStamp = async (
        signatureBase64: string,
        cfg: { useCustomStamp: boolean, customStampName: string, lema: string, orgName: string, orgRut: string }
      ): Promise<string> => {
        const W = 396, H = 260;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) return signatureBase64;
        ctx.clearRect(0, 0, W, H);

        const R = 110, cx = W / 2, cy = H / 2;
        ctx.save();
        ctx.globalAlpha = 0.15; ctx.strokeStyle = '#4338ca'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        const upperRaw = cfg.useCustomStamp ? (cfg.customStampName || cfg.orgName) : cfg.orgName;
        const upperText = (upperRaw || '').toUpperCase().substring(0, 24);
        ctx.save(); ctx.globalAlpha = 0.40; ctx.fillStyle = '#4338ca'; ctx.font = '10px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const uR = R - 14, tA = Math.PI * 0.90, sA = -Math.PI / 2 - tA / 2;
        for (let i = 0; i < upperText.length; i++) {
          const angle = sA + (i + 0.5) * (tA / upperText.length);
          ctx.save(); ctx.translate(cx + uR * Math.cos(angle), cy + uR * Math.sin(angle)); ctx.rotate(angle + Math.PI / 2); ctx.fillText(upperText[i], 0, 0); ctx.restore();
        }

        ctx.globalAlpha = 0.55; ctx.font = 'bold 9px Arial, sans-serif'; ctx.fillText('FIRMA', cx, cy - 8);
        if (!cfg.useCustomStamp && cfg.orgRut) {
          ctx.globalAlpha = 0.40; ctx.font = '8px Arial, sans-serif'; ctx.fillText(cfg.orgRut, cx, cy + 6);
        } else {
          ctx.globalAlpha = 0.40; ctx.font = '8px Arial, sans-serif'; ctx.fillText('REP. LEGAL', cx, cy + 6);
        }

        const lowerText = (cfg.lema || 'CAPAC. TÉCNICO PROFESIONAL').toUpperCase().substring(0, 24);
        const lR = R - 14, lT = Math.PI * 0.75, lS = Math.PI / 2 - lT / 2;
        ctx.globalAlpha = 0.40; ctx.font = '9px Arial, sans-serif';
        for (let i = 0; i < lowerText.length; i++) {
          const angle = lS + (i + 0.5) * (lT / lowerText.length);
          ctx.save(); ctx.translate(cx + lR * Math.cos(angle), cy + lR * Math.sin(angle)); ctx.rotate(angle - Math.PI / 2); ctx.fillText(lowerText[i], 0, 0); ctx.restore();
        }
        ctx.restore();

        if (signatureBase64 && signatureBase64.length > 10) {
          const sigImg = new Image();
          sigImg.src = signatureBase64;
          await new Promise((resolve) => { sigImg.onload = resolve; sigImg.onerror = resolve; });
          const sigAspect = sigImg.width / sigImg.height;
          const canvasAspect = W / H;
          let drawW, drawH, drawX, drawY;
          if (sigAspect > canvasAspect) {
            drawW = W - 10; drawH = drawW / sigAspect; drawX = 5; drawY = (H - drawH) / 2;
          } else {
            drawH = H - 10; drawW = drawH * sigAspect; drawX = (W - drawW) / 2; drawY = 5;
          }
          ctx.drawImage(sigImg, drawX, drawY, drawW, drawH);
        }
        return canvas.toDataURL('image/png');
      };

      // Prepare markers
      const markerData = {
        EMPRESA_OTEC: settings.name || 'OTEC',
        RUT_OTEC: settings.rut || '',
        RUT_EMPRESA_OTEC: settings.rut || '',
        NOMBRE_CURSO: course.nameVisible || course.senceData?.nombreCurso || '',
        NOMBRE_ALUMNO: enrollment.studentName,
        RUT_ALUMNO: formatRut(enrollment.studentRut),
        HORAS: course.senceData?.horasActividad?.toString() || '0',
        FECHA_INICIO: course.senceData?.fecInicio ? format(new Date(course.senceData.fecInicio), 'dd-MM-yyyy') : '',
        FECHA_TERMINO: course.senceData?.fecTermino ? format(new Date(course.senceData.fecTermino), 'dd-MM-yyyy') : '',
        FECHA_EMISION: course.senceData?.fecEmision ? format(new Date(course.senceData.fecEmision), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy'),
        FECHA_VENCIMIENTO: course.senceData?.fecVencimiento ? format(new Date(course.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
        CODIGO_SENCE: course.senceData?.codigoSence || '',
        RAZON_SOCIAL_EMPRESA: course.senceData?.empresa || '',
        RUT_EMPRESA: course.senceData?.rutEmpresa || '',
        EVALUACION: enrollment.evaluation || '6.5',
        ASISTENCIA: `${enrollment.attendance || 100}%`,
        ESTADO: enrollment.status,
        ID_CERTIFICADO: enrollment.id,
        REPRESENTANTE_NOMBRE: currentRepresentative?.name || '',
        REPRESENTANTE_RUT: currentRepresentative?.rut || '',
        // Image tags
        QR: 'QR',
        FIRMA_OTEC: 'FIRMA_OTEC',
        FIRMA: 'FIRMA',
        TIMBRE: 'TIMBRE'
      };

      // QR Code Base64
      const qrContainer = document.getElementById('qr-download-hidden');
      let qrBase64 = '';
      if (qrContainer) {
        const svg = qrContainer.querySelector('svg');
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement("canvas");
          canvas.width = 200; canvas.height = 200;
          const ctx = canvas.getContext("2d");
          const img = new Image();
          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
          await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
          ctx?.drawImage(img, 0, 0, 200, 200);
          qrBase64 = canvas.toDataURL("image/png");
        }
      }

      // Signature base64
      const rawSignatureBase64 = currentRepresentative?.signatureUrl 
        ? await urlToBase64(currentRepresentative.signatureUrl)
        : '';
      
      const stampConfig = {
        useCustomStamp: settings.useCustomStamp || false,
        customStampName: settings.customStampName || '',
        lema: settings.lema || '',
        orgName: settings.name || 'OTEC',
        orgRut: settings.rut || '',
      };

      const signatureWithStampBase64 = await compositeSignatureWithStamp(rawSignatureBase64, stampConfig);

      const images = {
        FIRMA: signatureWithStampBase64,
        FIRMA_OTEC: signatureWithStampBase64,
        QR: qrBase64,
        TIMBRE: '' 
      };

      // Template selection
      let templateBase64 = '';
      const builtIn = ['modern', 'diploma', 'classic', 'tech', 'minimal'];
      const templateId = course.templateId || 'modern';

      if (!builtIn.includes(templateId)) {
        const tDoc = await getDoc(doc(db, 'templates', templateId));
        if (tDoc.exists()) {
          const tData = tDoc.data() as ITemplate;
          templateBase64 = tData.fileData;
          if (tData.isCompressed) {
            templateBase64 = LZString.decompressFromUTF16(templateBase64) || '';
          }
        }
      }

      const endpoint = asPdf ? '/api/generate-certificate-pdf' : '/api/generate-certificate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateBase64: templateBase64,
          data: markerData,
          images: images,
          stampConfig: stampConfig
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
      const extension = asPdf ? 'pdf' : 'docx';
      a.download = `Certificado_${enrollment.studentName.replace(/\s+/g, '_')}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('LibreOffice') || err?.message?.includes('libreoffice')) {
        setLibreOfficeError(err.message);
      } else {
        alert('Error: ' + (err?.message || 'Hubo un error al descargar el certificado.'));
      }
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 text-teal-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (errorStatus || !enrollment || !course) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-3xl shadow-xl max-w-md w-full text-center">
          <XCircle className="h-20 w-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Validación Fallida</h1>
          <p className="text-slate-500 mb-8">
            {errorStatus || 'El certificado no pudo ser verificado. Es posible que el código sea inválido o haya sido revocado.'}
          </p>
          <Link to="/" className="inline-block bg-slate-100 text-slate-600 px-6 py-2 rounded-xl font-bold hover:bg-slate-200 transition-colors">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start p-4 sm:p-8 pt-12 md:pt-20">
      {/* Hidden QR for download */}
      <div id="qr-download-hidden" className="hidden">
        <QRCodeSVG value={`${window.location.origin}/validar/${enrollment.id}`} size={200} />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
      >
        {/* Header Section */}
        <div className="p-10 pb-6 text-center">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-28 mx-auto mb-6 object-contain" />
          ) : (
            <div className="space-y-2 mb-6">
              <h1 className="text-3xl font-black text-teal-800 tracking-tighter">Laboralcap E.I.R.L.</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Organismo Técnico de Capacitación</p>
            </div>
          )}

          <div className="mt-12 flex flex-col items-center">
            <div className="flex items-center justify-center h-28 w-28 rounded-full bg-teal-600 shadow-2xl shadow-teal-600/30 mb-8 border-[10px] border-teal-50">
              <CheckCircle2 className="h-14 w-14 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter font-serif">Certificado Verificado</h2>
            <div className="mt-4 flex items-center space-x-2 text-teal-600 bg-teal-50 px-4 py-1.5 rounded-full border border-teal-100">
              <div className="h-2 w-2 rounded-full bg-teal-600 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">Autenticidad Confirmada por OTEC</span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-10 pb-12 space-y-12">
          {/* Informacion del Alumno */}
          <div className="space-y-5">
            <div className="flex items-center space-x-3 text-teal-600">
              <User className="h-5 w-5" strokeWidth={2.5} />
              <h3 className="text-[12px] font-black uppercase tracking-[0.2em] font-serif">Información del Alumno</h3>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 md:p-10">
              <h4 className="text-3xl font-black text-slate-900 font-serif mb-4 leading-tight">{enrollment.studentName}</h4>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="bg-white px-5 py-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cédula Identidad</span>
                  <span className="text-slate-900 font-mono text-lg font-black tracking-tighter">{formatRut(enrollment.studentRut)}</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-400 px-4 py-2 border-l-2 border-slate-100">
                  <Calendar className="h-5 w-5" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest">Fecha de Emisión</span>
                    <span className="text-xs font-bold text-slate-600">{format(new Date(enrollment.enrollmentDate || Date.now()), "d 'de' MMMM, yyyy", { locale: es })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Informacion del Curso */}
          <div className="space-y-5">
            <div className="flex items-center space-x-3 text-teal-600">
              <Award className="h-5 w-5" strokeWidth={2.5} />
              <h3 className="text-[12px] font-black uppercase tracking-[0.2em] font-serif">Información del Curso</h3>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 md:p-10">
              <h4 className="text-3xl font-black text-slate-900 font-serif mb-4 leading-tight">{course.nameVisible}</h4>
              <div className="space-y-4">
                 <div className="flex items-center space-x-4">
                   <div className="h-1 w-8 bg-teal-600 rounded-full"></div>
                   <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{settings?.name || 'Laboralcap E.I.R.L.'}</p>
                 </div>
                 {course.senceData?.codigoSence && (
                   <div className="inline-block bg-teal-950 text-emerald-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-900">
                     SENCE: {course.senceData.codigoSence}
                   </div>
                 )}
              </div>
            </div>
          </div>

          {/* Validated Footer Box */}
          <div className="bg-slate-900 rounded-3xl p-8 flex items-center space-x-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:bg-teal-500/20 transition-all"></div>
            <div className="bg-teal-500/20 p-3 rounded-2xl border border-teal-500/30">
              <CheckCircle2 className="h-8 w-8 text-teal-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-black font-serif text-lg leading-tight mb-1">Documento Oficial</p>
              <p className="text-teal-400/60 text-[9px] font-black uppercase tracking-[0.2em]">Validado via Blockchain • ID: {enrollment.id.slice(0, 16)}</p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
            <button
              onClick={() => handleDownload(true)}
              disabled={isDownloading}
              className="flex-1 group relative flex items-center justify-center space-x-4 bg-red-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-red-600/30 hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Download className="h-6 w-6 group-hover:translate-y-1 transition-transform" />
              )}
              <span className="tracking-widest">{isDownloading ? 'Generando...' : 'Descargar PDF'}</span>
            </button>

            <button
              onClick={() => handleDownload(false)}
              disabled={isDownloading}
              className="flex-1 group relative flex items-center justify-center space-x-4 bg-teal-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-teal-600/30 hover:bg-teal-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Download className="h-6 w-6 group-hover:translate-y-1 transition-transform" />
              )}
              <span className="tracking-widest">{isDownloading ? 'Generando...' : 'Descargar Word'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      <footer className="mt-16 text-center pb-12">
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.5em] opacity-30">
          Digital Trust Ecosystem • {settings?.name || 'Laboralcap E.I.R.L.'}
        </p>
      </footer>

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
    </div>
  );
}

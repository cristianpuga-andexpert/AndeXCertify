import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Enrollment, Course, OrganizationSettings, Representative } from '../types';
import { CheckCircle2, Calendar, Download, Loader2, AlertCircle, XCircle, X, Terminal, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatRut, arrayBufferToBase64 } from '../lib/utils';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

export function CertificateValidation() {
  const { certificateId } = useParams();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
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

      console.log('🔍 Validating certificate:', certificateId);

      try {
        const res = await fetch(`/api/public/validate/${certificateId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error || res.statusText);
        }
        const data = await res.json();
        setEnrollment(data.enrollment);
        setCourse(data.course);
        setSettings(data.settings || null);
        setRepresentatives(data.representatives || []);
        setTemplateUrl(data.templateUrl ?? null);
        console.log('✅ Certificate data loaded:', data.enrollment?.studentName);
      } catch (err: any) {
        console.error('❌ Verification Error:', err);
        setErrorStatus(err.message || 'Error al conectar con el servicio de verificación');
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
          console.error('Error converting URL to base64:', e);
          return '';
        }
      };

      /**
       * Genera imagen compuesta: firma PNG + sello circular semitransparente superpuesto.
       */
      const compositeSignatureWithStamp = async (
        signatureBase64: string,
        cfg: { useCustomStamp: boolean; customStampName: string; lema: string; orgName: string; orgRut: string }
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
        QR: 'QR',
        FIRMA_OTEC: 'FIRMA_OTEC',
        FIRMA: 'FIRMA',
        TIMBRE: 'TIMBRE',
      };

      // QR Code Base64
      const qrContainer = document.getElementById('qr-download-hidden');
      let qrBase64 = '';
      if (qrContainer) {
        const svg = qrContainer.querySelector('svg');
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement('canvas');
          canvas.width = 200; canvas.height = 200;
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
          await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
          ctx?.drawImage(img, 0, 0, 200, 200);
          qrBase64 = canvas.toDataURL('image/png');
        }
      }

      const rawSignatureBase64 = currentRepresentative?.signatureUrl
        ? await urlToBase64(currentRepresentative.signatureUrl)
        : '';

      const stampConfig = {
        useCustomStamp: settings.useCustomStamp || false,
        customStampName: settings.customStampName || '',
        lema: settings.lema || '',
        orgName: settings.name || 'OTEC',
        orgRut: settings.rut || '',
        stampStyle: settings.stampStyle || 'circular_double',
      };

      const signatureWithStampBase64 = await compositeSignatureWithStamp(rawSignatureBase64, stampConfig);

      const images = {
        FIRMA: signatureWithStampBase64,
        FIRMA_OTEC: signatureWithStampBase64,
        QR: qrBase64,
        TIMBRE: '',
      };

      // Template: fetch DOCX from S3 if custom, otherwise built-in name is sent empty
      let templateBase64 = '';
      const builtIn = ['modern', 'diploma', 'classic', 'tech', 'minimal'];
      const templateId = course.templateId || 'modern';

      if (!builtIn.includes(templateId) && templateUrl) {
        const fileRes = await fetch(templateUrl);
        if (fileRes.ok) {
          const buf = await fileRes.arrayBuffer();
          templateBase64 =
            'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' +
            arrayBufferToBase64(buf);
        }
      }

      const endpoint = asPdf ? '/api/generate-certificate-pdf' : '/api/generate-certificate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateBase64,
          data: markerData,
          images,
          stampConfig,
        }),
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
      <div className="min-h-screen bg-surface flex items-center justify-center p-8">
        <Loader2 className="h-12 w-12 text-brand animate-spin" />
      </div>
    );
  }

  if (errorStatus || !enrollment || !course) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="card-base p-12 max-w-md w-full text-center">
          <div className="h-20 w-20 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Validación Fallida</h1>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            {errorStatus || 'El certificado no pudo ser verificado. Es posible que el código sea inválido o haya sido revocado.'}
          </p>
          <Link to="/" className="btn-secondary inline-flex">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-start p-4 sm:p-8 pt-12 md:pt-20">
      {/* Hidden QR for download */}
      <div id="qr-download-hidden" className="hidden">
        <QRCodeSVG value={`${window.location.origin}/validar/${enrollment.id}`} size={200} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-xl"
      >
        {/* ── Logo / org header ── */}
        <div className="text-center mb-8">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-16 mx-auto mb-3 object-contain" />
          ) : (
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{settings?.name || ''}</p>
          )}
        </div>

        {/* ── Main card ── */}
        <div className="card-base overflow-visible">

          {/* Verification badge */}
          <div className="flex flex-col items-center pt-10 pb-8 px-8 border-b border-slate-100">
            <div className="h-20 w-20 rounded-full bg-brand flex items-center justify-center shadow-xl shadow-brand/30 mb-6 ring-8 ring-brand/10">
              <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Certificado Verificado</h2>
            <div className="flex items-center space-x-2 bg-brand/10 text-brand px-4 py-1.5 rounded-full border border-brand/20">
              <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest">Autenticidad Confirmada por OTEC</span>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* ── Alumno ── */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-1 w-1 rounded-full bg-brand" />
                <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">Información del Alumno</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{enrollment.studentName}</h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cédula Identidad</span>
                    <span className="text-slate-900 font-mono font-black text-base tracking-tight">{formatRut(enrollment.studentRut)}</span>
                  </div>
                  <div className="flex items-center space-x-2.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fecha de Emisión</span>
                      <span className="text-slate-700 font-bold text-sm">{format(new Date(enrollment.enrollmentDate || Date.now()), "d 'de' MMMM, yyyy", { locale: es })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Curso ── */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-1 w-1 rounded-full bg-brand" />
                <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">Información del Curso</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{course.nameVisible}</h3>
                <div className="flex items-center space-x-3">
                  <div className="h-0.5 w-6 bg-brand rounded-full" />
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{settings?.name || ''}</p>
                </div>
                {course.senceData?.codigoSence && (
                  <div className="inline-flex bg-slate-900 text-brand px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border border-slate-700">
                    SENCE: {course.senceData.codigoSence}
                  </div>
                )}
              </div>
            </div>

            {/* ── Documento Oficial box ── */}
            <div className="bg-slate-900 rounded-2xl p-6 flex items-center space-x-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-transparent pointer-events-none" />
              <div className="bg-brand/20 p-2.5 rounded-xl border border-brand/30 shrink-0">
                <CheckCircle2 className="h-6 w-6 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base leading-tight mb-0.5">Documento Oficial</p>
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.15em] truncate">
                  Validado vía Sistema AndeXCertify · ID: {enrollment.id.slice(0, 16)}
                </p>
              </div>
            </div>

            {/* ── PDF button ── */}
            <button
              onClick={() => handleDownload(true)}
              disabled={isDownloading}
              className="w-full btn-primary py-4 text-[11px] disabled:opacity-50 space-x-3"
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span>{isDownloading ? 'Generando PDF...' : 'Descargar Certificado PDF'}</span>
            </button>
          </div>
        </div>

        <footer className="mt-10 text-center pb-12">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.4em] opacity-50">
            AndeXCertify · Sistema de Gestión de Certificados
          </p>
        </footer>
      </motion.div>

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

              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-rose-700 text-xs font-black uppercase tracking-wider">
                  <Terminal className="h-4 w-4" />
                  <span>Detalle del Error del Servidor</span>
                </div>
                <p className="text-xs font-mono text-rose-800 bg-rose-50 p-3 rounded-lg overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
                  {libreOfficeError}
                </p>
              </div>

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
                      navigator.clipboard.writeText('sudo apt update && sudo apt install -y libreoffice');
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

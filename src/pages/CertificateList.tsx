import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Enrollment, Course, OrganizationSettings, Representative, CertificateTemplate as ITemplate, EnrollmentStatus } from '../types';
import { ArrowLeft, Download, UserCheck, Printer, Award, Loader2, AlertCircle, X, Terminal, Copy, Check } from 'lucide-react';
import { cn, formatRut } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import JSZip from 'jszip';
import { api } from '../lib/api';

const BUILT_IN_TEMPLATES = ['modern', 'diploma', 'classic'];

async function fetchTemplateBase64FromS3Key(s3Key: string): Promise<string> {
  const res = await fetch(`/api/templates/signed-url?key=${encodeURIComponent(s3Key)}`);
  if (!res.ok) throw new Error('No se pudo obtener la URL del template');
  const { url } = await res.json();
  const fileRes = await fetch(url);
  if (!fileRes.ok) throw new Error('No se pudo descargar la plantilla');
  const buf = await fileRes.arrayBuffer();
  return 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' +
    btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function CertificateList() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [customTemplateBlob, setCustomTemplateBlob] = useState<ArrayBuffer | null>(null);
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(null);
  const [customTemplateS3Key, setCustomTemplateS3Key] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState<string>('modern');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [libreOfficeError, setLibreOfficeError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!courseId || !user) return;

    const loadAll = async () => {
      try {
        const [c, s, reps, enrollments] = await Promise.all([
          api.get<Course>(`/api/courses/${courseId}`),
          api.get<OrganizationSettings>('/api/settings'),
          api.get<Representative[]>('/api/representatives'),
          api.get<Enrollment[]>(`/api/courses/${courseId}/enrollments`),
        ]);

        setCourse(c);
        setSettings(Object.keys(s).length > 0 ? s : null);
        setRepresentatives(reps);
        setStudents(enrollments);

        // Determine preview mode
        if (c.templateId && !BUILT_IN_TEMPLATES.includes(c.templateId)) {
          setPreviewMode('custom');
          // Load custom template from S3
          const templates = await api.get<ITemplate[]>('/api/templates');
          const tpl = templates.find(t => t.id === c.templateId);
          if (tpl) {
            setCustomTemplateName(tpl.name);
            setCustomTemplateS3Key(tpl.fileData); // fileData = S3 key

            const base64 = await fetchTemplateBase64FromS3Key(tpl.fileData);
            const base64Data = base64.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            setCustomTemplateBlob(bytes.buffer);
          }
        } else {
          setPreviewMode(c.templateId || 'modern');
        }
      } catch (err) {
        console.error('Error loading certificate data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
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

  const handlePrint = () => { window.print(); };

  const getTemplateData = async (): Promise<string> => {
    if (!course) throw new Error('Curso no cargado');
    if (customTemplateS3Key) {
      return fetchTemplateBase64FromS3Key(customTemplateS3Key);
    }
    throw new Error('No hay plantilla personalizada configurada');
  };

  const handleExportBatch = async () => {
    if (selectedStudents.length === 0 || !course || isExporting) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const selectedData = students.filter(s => selectedStudents.includes(s.id));
      const JSZipModule = (await import('jszip')).default;
      const zip = new JSZipModule();

      const templateData = await getTemplateData();

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

      const currentRepresentative = representatives[0] || null;
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
          EMPRESA_OTEC: settings?.name || '',
          RUT_OTEC: settings?.rut || '',
          RUT_EMPRESA_OTEC: settings?.rut || '',
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
          REPRESENTANTE_NOMBRE: currentRepresentative?.name || '',
          REPRESENTANTE_RUT: currentRepresentative?.rut || '',
          NOMBRE_RE_OTEC: currentRepresentative?.name || '',
          RUT_RE_OTEC: currentRepresentative?.rut || '',
          CONTENIDO_CURSO: course.description || '',
          DESCRIPCION_CURSO: course.description || '',
          QR: 'QR', FIRMA_OTEC: 'FIRMA_OTEC', FIRMA: 'FIRMA', TIMBRE: 'TIMBRE'
        };

        let qrBase64 = '';
        const qrElement = document.getElementById(`qr-hidden-${student.id}`);
        if (qrElement) {
          const svg = qrElement.querySelector('svg');
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

        const response = await api.postRaw('/api/generate-certificate', {
          templateBase64: templateData,
          data: markerData,
          images: { FIRMA: rawSignatureBase64, FIRMA_OTEC: rawSignatureBase64, QR: qrBase64, TIMBRE: '' },
          stampConfig: stampConfigForBatch
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
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (docxBlobs.length > 1) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Lote_Certificados_${course.nameVisible.replace(/\s+/g, '_')}.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
    if (studentIds.length === 0 || !course || isExporting) return;
    if (!customTemplateS3Key) return; // PDF export requires a custom DOCX template

    setIsExporting(true);
    setExportProgress(10);

    try {
      const selectedData = students.filter(s => studentIds.includes(s.id));
      const templateData = await getTemplateData();

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

      const currentRepresentative = representatives[0] || null;
      const rawSignatureBase64 = currentRepresentative?.signatureUrl
        ? await urlToBase64(currentRepresentative.signatureUrl)
        : '';

      const stampConfigForBatch = {
        useCustomStamp: settings?.useCustomStamp || false,
        customStampName: settings?.customStampName || '',
        lema: settings?.lema || '',
        orgName: settings?.name || '',
        orgRut: settings?.rut || '',
        stampStyle: settings?.stampStyle || 'circular_double',
      };

      setExportProgress(20);

      const buildMarkers = (student: Enrollment): Record<string, string> => ({
        EMPRESA_OTEC: settings?.name || '',
        RUT_OTEC: settings?.rut || '',
        RUT_EMPRESA_OTEC: settings?.rut || '',
        NOMBRE_CURSO: course!.nameVisible || '',
        NOMBRE_ALUMNO: student.studentName,
        RUT_ALUMNO: student.studentRut,
        HORAS: course!.senceData?.horasActividad?.toString() || '0',
        FECHA_INICIO: course!.senceData?.fecInicio ? format(new Date(course!.senceData.fecInicio), 'dd-MM-yyyy') : '',
        FECH_INI: course!.senceData?.fecInicio ? format(new Date(course!.senceData.fecInicio), 'dd-MM-yyyy') : '',
        FECHA_TERMINO: course!.senceData?.fecTermino ? format(new Date(course!.senceData.fecTermino), 'dd-MM-yyyy') : '',
        FECH_TER: course!.senceData?.fecTermino ? format(new Date(course!.senceData.fecTermino), 'dd-MM-yyyy') : '',
        FECHA_EMISION: format(new Date(), 'dd-MM-yyyy'),
        FECH_EMI: format(new Date(), 'dd-MM-yyyy'),
        FECHA_VENCIMIENTO: course!.senceData?.fecVencimiento ? format(new Date(course!.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
        FECH_VEN: course!.senceData?.fecVencimiento ? format(new Date(course!.senceData.fecVencimiento), 'dd-MM-yyyy') : '',
        CODIGO_SENCE: course!.senceData?.codigoSence || '',
        EMPRESA_CLIENTE: course!.senceData?.empresa || '',
        RUT_EMPRESA_CLIENTE: course!.senceData?.rutEmpresa || '',
        EVALUACION: student.evaluation || '',
        ASISTENCIA: `${student.attendance || 100}%`,
        ESTADO: student.status,
        ID_CERTIFICADO: student.id,
        NOMBRE_RE_OTEC: currentRepresentative?.name || '',
        RUT_RE_OTEC: currentRepresentative?.rut || '',
        CONTENIDO_CURSO: course!.description || '',
        QR: 'QR', FIRMA_OTEC: 'FIRMA_OTEC', FIRMA: 'FIRMA', TIMBRE: 'TIMBRE'
      });

      const getQRBase64 = async (studentId: string): Promise<string> => {
        const qrEl = document.getElementById(`qr-hidden-${studentId}`);
        if (!qrEl) return '';
        const svg = qrEl.querySelector('svg');
        if (!svg) return '';
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        canvas.width = 200; canvas.height = 200;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        await new Promise(r => { img.onload = r; img.onerror = r; });
        ctx?.drawImage(img, 0, 0, 200, 200);
        return canvas.toDataURL('image/png');
      };

      if (selectedData.length === 1) {
        const student = selectedData[0];
        const qrBase64 = await getQRBase64(student.id);
        setExportProgress(50);

        const response = await api.postRaw('/api/generate-certificate-pdf', {
          templateBase64: templateData,
          data: buildMarkers(student),
          images: { FIRMA: rawSignatureBase64, FIRMA_OTEC: rawSignatureBase64, QR: qrBase64, TIMBRE: '' },
          stampConfig: stampConfigForBatch
        });

        if (!response.ok) {
          const rawText = await response.text();
          let parsedError = rawText;
          try { const parsed = JSON.parse(rawText); parsedError = parsed.details || parsed.error || rawText; } catch {}
          throw new Error(parsedError);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificado_${student.studentName.replace(/\s+/g, '_')}_${(course.nameVisible || '').replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportProgress(100);
      } else {
        const JSZipModule = (await import('jszip')).default;
        const zip = new JSZipModule();

        for (let i = 0; i < selectedData.length; i++) {
          const student = selectedData[i];
          setExportProgress(20 + Math.round((i / selectedData.length) * 70));
          const qrBase64 = await getQRBase64(student.id);

          const response = await api.postRaw('/api/generate-certificate-pdf', {
            templateBase64: templateData,
            data: buildMarkers(student),
            images: { FIRMA: rawSignatureBase64, FIRMA_OTEC: rawSignatureBase64, QR: qrBase64, TIMBRE: '' },
            stampConfig: stampConfigForBatch
          });

          if (!response.ok) {
            const rawText = await response.text();
            let parsedError = rawText;
            try { const parsed = JSON.parse(rawText); parsedError = parsed.details || parsed.error || rawText; } catch {}
            throw new Error(parsedError);
          }
          const pdfBlob = await response.blob();
          const studentName = student.studentName.replace(/\s+/g, '_');
          const courseName = (course.nameVisible || '').replace(/\s+/g, '_');
          zip.file(`Certificado_${studentName}_${courseName}.pdf`, pdfBlob);
        }

        setExportProgress(90);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificados_${(course.nameVisible || 'Lote').replace(/\s+/g, '_')}.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-12 gap-6">
          <div className="flex items-start space-x-6">
            <Link to="/" className="mt-2 h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-all shadow-sm group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div>
              <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-[0.15em] mb-2">
                <Link to="/" className="text-brand hover:underline underline-offset-2 transition-colors">Panel de Cursos</Link>
                <span className="text-slate-300">/</span>
                <span className="text-slate-400 max-w-[180px] truncate">{course?.nameVisible || course?.nameReference || '...'}</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700">Certificados</span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                Gestión de <span className="text-brand">Certificados</span>
              </h1>
              <p className="text-slate-500 mt-2 font-medium text-xs uppercase tracking-widest opacity-60">Curso: <span className="text-slate-900 font-bold">{course?.nameVisible}</span></p>
            </div>
          </div>

          {/* Panel unificado: selector + acciones — visualmente relacionados */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 shrink-0">

            {/* Fila 1 — Selector de plantilla */}
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                Plantilla del certificado
              </span>
              <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                {!customTemplateBlob && (
                  <>
                    {[
                      { id: 'modern',  label: 'Panel Lateral'   },
                      { id: 'diploma', label: 'Elegante Oscuro' },
                      { id: 'classic', label: 'Franja Superior' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setPreviewMode(id)}
                        title={label}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                          previewMode === id ? "bg-white shadow-md text-brand" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </>
                )}
                {customTemplateBlob && (
                  <button
                    onClick={() => setPreviewMode('custom')}
                    title="Plantilla Word personalizada"
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                      previewMode === 'custom' ? "bg-white shadow-md text-brand" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {customTemplateName || 'Plantilla'}
                  </button>
                )}
              </div>
            </div>

            {/* Separador */}
            <div className="h-px bg-slate-100" />

            {/* Fila 2 — Botones de exportación */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadPDF(selectedStudents)}
                disabled={selectedStudents.length === 0 || isExporting || !customTemplateS3Key}
                title={
                  !customTemplateS3Key
                    ? 'PDF requiere una plantilla Word personalizada'
                    : selectedStudents.length === 0
                    ? 'Selecciona al menos un participante'
                    : `Descargar ${selectedStudents.length} certificado(s) en PDF`
                }
                className="btn-primary flex items-center space-x-2 py-2.5 px-5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                <span>
                  {isExporting ? 'Exportando...' : `PDF${selectedStudents.length > 0 ? ` (${selectedStudents.length})` : ''}`}
                </span>
              </button>
<button
                onClick={handlePrint}
                disabled={selectedStudents.length === 0}
                title={selectedStudents.length === 0 ? 'Selecciona al menos un participante' : 'Imprimir listado de participantes'}
                className="btn-secondary flex items-center space-x-2 py-2.5 px-5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card-base shadow-2xl shadow-slate-200/50">
          {/* Header row — mismo patrón que CourseList */}
          <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-6 py-4 items-center">
            <div className="col-span-1 flex items-center">
              <input
                type="checkbox"
                checked={selectedStudents.length === students.length && students.length > 0}
                onChange={selectAll}
                className="h-4 w-4 text-brand focus:ring-brand rounded border-slate-300"
              />
            </div>
            <div className="col-span-5 text-[10px] uppercase font-black text-slate-400 tracking-widest">Alumno</div>
            <div className="col-span-3 text-[10px] uppercase font-black text-slate-400 tracking-widest">RUT</div>
            <div className="col-span-2 text-[10px] uppercase font-black text-slate-400 tracking-widest">Estado</div>
            <div className="col-span-1 text-[10px] uppercase font-black text-slate-400 tracking-widest text-right">
              {selectedStudents.length}<span className="text-slate-300">/{students.length}</span>
            </div>
          </div>

          {/* Rows */}
          {students.length === 0 ? (
            <div className="py-24 text-center">
              <Award className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No hay alumnos inscritos en este curso</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {students.map((student, idx) => (
                <div
                  key={student.id}
                  onClick={() => toggleSelect(student.id)}
                  className="grid grid-cols-12 items-center px-6 py-5 cursor-pointer group hover:bg-slate-900 transition-all duration-300"
                >
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      readOnly
                      style={{ pointerEvents: 'none' }}
                      className="h-4 w-4 text-brand rounded border-slate-300"
                    />
                  </div>
                  <div className="col-span-5">
                    <div className="text-sm font-black text-slate-900 group-hover:text-white transition-colors tracking-tight">
                      {student.studentName}
                    </div>
                  </div>
                  <div className="col-span-3 font-mono text-[11px] text-slate-500 group-hover:text-slate-400 transition-colors">
                    {formatRut(student.studentRut)}
                  </div>
                  <div className="col-span-2">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter",
                      student.status === EnrollmentStatus.APROBADO
                        ? "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-900 group-hover:text-emerald-400"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-400"
                    )}>
                      {student.status}
                    </span>
                  </div>
                  <div className="col-span-1 font-mono text-[10px] text-slate-300 group-hover:text-slate-600 transition-colors text-right">
                    {(idx + 1).toString().padStart(2, '0')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hidden QR Codes */}
      <div className="hidden">
        {students.map(s => (
          <div key={`qr-cont-${s.id}`} id={`qr-hidden-${s.id}`}>
            <QRCodeSVG value={`${window.location.origin}/validar/${s.id}`} size={200} level="H" />
          </div>
        ))}
        <div id="docx-render-hidden" style={{ opacity: 0, pointerEvents: 'none', position: 'absolute', top: -9999, width: '210mm', minHeight: '297mm' }} />
      </div>

      {/* Print View — Participant List */}
      <div className="hidden print:block" style={{ fontFamily: 'sans-serif' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', fontWeight: '900', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '6px' }}>
            Centro de Emisión · AndeXCertify
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: 0 }}>
            {course?.nameVisible}
          </h1>
          <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', marginBottom: 0 }}>
            Listado de Participantes · Impreso el {format(new Date(), 'dd/MM/yyyy')}
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              {['#', 'Alumno', 'RUT', 'Estado', 'Evaluación', 'Asistencia'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '8px', color: '#64748b', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students
              .filter(s => selectedStudents.includes(s.id))
              .map((student, idx) => (
                <tr key={student.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '9px 10px', color: '#94a3b8', fontWeight: '700', borderBottom: '1px solid #f1f5f9', fontSize: '10px' }}>{idx + 1}</td>
                  <td style={{ padding: '9px 10px', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>{student.studentName}</td>
                  <td style={{ padding: '9px 10px', color: '#475569', fontFamily: 'monospace', borderBottom: '1px solid #f1f5f9' }}>{formatRut(student.studentRut)}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{
                      backgroundColor: student.status === EnrollmentStatus.APROBADO ? '#d1fae5' : '#f1f5f9',
                      color: student.status === EnrollmentStatus.APROBADO ? '#065f46' : '#64748b',
                      padding: '2px 8px', borderRadius: '20px', fontSize: '8px', fontWeight: '900',
                      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
                    }}>
                      {student.status}
                    </span>
                  </td>
                  <td style={{ padding: '9px 10px', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>{student.evaluation || '—'}</td>
                  <td style={{ padding: '9px 10px', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>{student.attendance != null ? `${student.attendance}%` : '100%'}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '9px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
          <span>AndeXCertify — Sistema de Gestión de Certificados</span>
          <span>{students.filter(s => selectedStudents.includes(s.id)).length} participante(s) seleccionados</span>
        </div>
      </div>

      {/* LibreOffice Error Modal */}
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
              <button onClick={() => setLibreOfficeError(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-xl transition-all">
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
                <div className="bg-slate-900 rounded-xl p-4 pl-7 font-mono text-[11px] text-emerald-400 relative group">
                  <pre className="overflow-x-auto select-all">{`sudo apt update\nsudo apt install -y libreoffice`}</pre>
                  <button
                    onClick={() => { navigator.clipboard.writeText("sudo apt update && sudo apt install -y libreoffice"); setCopiedText(true); setTimeout(() => setCopiedText(false), 2000); }}
                    className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedText ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex justify-end bg-slate-50">
              <button onClick={() => setLibreOfficeError(null)} className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-800/10 hover:scale-[1.02] active:scale-[0.98]">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>
    </div>
  );
}

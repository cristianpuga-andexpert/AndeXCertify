import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Course, Enrollment, OrganizationSettings, Representative } from '../../types';
import { format } from 'date-fns';
import { formatRut } from '../../lib/utils';
import { renderAsync } from 'docx-preview';

interface Props {
  course: Course;
  enrollment: Enrollment;
  settings?: OrganizationSettings | null;
  representative?: Representative | null;
  templateId?: string;
  templateBlob?: ArrayBuffer | null;
}

// Spanish month names
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio',
                   'agosto','septiembre','octubre','noviembre','diciembre'];
const formatDateES = (dateStr?: string): string => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
};

export function CertificateTemplate({ course, enrollment, settings, representative, templateId, templateBlob }: Props) {
  if (!enrollment || !course) return null;

  const verificationUrl = `${window.location.origin}/verify/${enrollment.id}`;
  const orgName   = settings?.name || 'Organización';
  const orgRut    = settings?.rut  || '';
  const repName   = representative?.name || '';
  const signatureUrl = representative?.signatureUrl;
  const courseName   = course.nameVisible || course.senceData?.nombreCurso || '';
  const hours        = course.senceData?.horasActividad;
  const emisionDate  = formatDateES(course.senceData?.fecEmision);
  const initials     = orgName.slice(0, 2).toUpperCase();

  // Navy / green / orange — palette from client designs
  const NAVY   = '#1B2F5B';
  const GREEN  = '#7DC240';
  const ORANGE = '#F5A623';

  const backgroundStyle = course.customAssetUrl ? {
    backgroundImage: `url(${course.customAssetUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : {};

  // ── Custom Word template ──────────────────────────────────────────────────────
  if (templateId === 'custom' && templateBlob) {
    return (
      <CustomDocxTemplate
        templateBlob={templateBlob}
        enrollment={enrollment}
        course={course}
        settings={settings}
        representative={representative}
        backgroundStyle={backgroundStyle}
      />
    );
  }

  // ── TEMPLATE "diploma" — Foto 2: Elegante Oscuro ─────────────────────────────
  if (templateId === 'diploma') {
    return (
      <div
        id={`cert-${enrollment.id}`}
        className="w-[794px] h-[1123px] flex flex-col items-center font-sans shadow-2xl mx-auto my-0 printable-area relative overflow-hidden"
        style={{ backgroundColor: NAVY }}
      >
        {/* Green frame */}
        <div className="absolute inset-[10px] rounded pointer-events-none"
             style={{ border: `2px solid ${GREEN}` }} />

        <div className="flex flex-col items-center justify-between h-full px-16 py-12 z-10 w-full">

          {/* ─ TOP ─ */}
          <div className="flex flex-col items-center w-full">
            {/* Logo circle */}
            <div className="h-24 w-24 rounded-full flex flex-col items-center justify-center mb-4"
                 style={{ border: `2px solid ${ORANGE}` }}>
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} className="h-16 w-16 object-contain rounded-full" alt="Logo" />
              ) : (
                <>
                  <span className="text-2xl font-black text-white leading-none">{initials}</span>
                  <span className="text-[6px] font-black uppercase tracking-widest mt-0.5"
                        style={{ color: ORANGE }}>OTEC · SENCE</span>
                </>
              )}
            </div>

            <div className="text-[10px] font-black text-white uppercase tracking-[0.25em]">{orgName}</div>
            {orgRut && (
              <div className="text-[8px] mt-0.5 tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>{orgRut}</div>
            )}

            {/* Diamond divider */}
            <div className="flex items-center space-x-3 my-4">
              <div className="h-px w-20" style={{ backgroundColor: ORANGE }} />
              <div className="h-2 w-2 rotate-45" style={{ backgroundColor: ORANGE }} />
              <div className="h-px w-20" style={{ backgroundColor: ORANGE }} />
            </div>

            {/* Title */}
            <div className="text-[78px] font-black text-white leading-none tracking-tight">CERTIFI</div>
            <div className="text-[78px] font-black leading-none tracking-tight" style={{ color: GREEN }}>CADO</div>
            <div className="text-[10px] font-bold tracking-[0.5em] mt-2"
                 style={{ color: 'rgba(255,255,255,0.45)' }}>DE APROBACIÓN</div>

            {/* Divider */}
            <div className="flex items-center space-x-3 mt-5">
              <div className="h-px w-32" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <div className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: ORANGE }} />
              <div className="h-px w-32" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            </div>
          </div>

          {/* ─ MIDDLE ─ */}
          <div className="flex flex-col items-center w-full mt-4">
            <p className="text-sm italic mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              certifica que el participante
            </p>
            <div className="text-[34px] font-black italic text-white text-center leading-snug mb-2">
              {enrollment.studentName}
            </div>
            <p className="text-sm italic mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              ha completado satisfactoriamente el programa
            </p>

            {/* Course name */}
            <div className="w-full border rounded-lg px-8 py-4 mb-5 text-center"
                 style={{ borderColor: ORANGE, backgroundColor: 'rgba(245,166,35,0.07)' }}>
              <div className="text-base font-black text-white leading-snug">{courseName}</div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-3 w-full">
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div className="text-3xl font-black leading-none mb-0.5" style={{ color: GREEN }}>
                  {hours ?? '—'}
                </div>
                <div className="text-[7px] font-black uppercase tracking-widest text-white">HORAS LECTIVAS</div>
                <div className="text-[7px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Duración total</div>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div className="text-sm font-black text-white mb-0.5">E-Learning</div>
                <div className="text-[7px] font-black uppercase tracking-widest" style={{ color: GREEN }}>MODALIDAD</div>
                <div className="text-[7px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Aula Virtual</div>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div className="text-sm font-black text-white mb-0.5">{emisionDate}</div>
                <div className="text-[7px] font-black uppercase tracking-widest" style={{ color: ORANGE }}>EMISIÓN</div>
              </div>
            </div>

            <p className="text-[11px] italic text-center max-w-md leading-relaxed mt-5"
               style={{ color: 'rgba(255,255,255,0.35)' }}>
              {course.description ||
               'El presente certificado se otorga en reconocimiento al compromiso y dedicación demostrados durante el proceso de aprendizaje.'}
            </p>
          </div>

          {/* ─ BOTTOM ─ */}
          <div className="w-full mt-4">
            {/* Stamp */}
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full flex items-center justify-center"
                   style={{ border: `2px dashed rgba(125,194,64,0.35)` }}>
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} className="h-9 w-9 object-contain rounded-full" alt="" />
                ) : (
                  <span className="text-[7px] font-black uppercase text-center leading-tight px-1"
                        style={{ color: 'rgba(255,255,255,0.35)' }}>{initials}</span>
                )}
              </div>
            </div>

            {/* Signature lines */}
            <div className="flex justify-around">
              <div className="flex flex-col items-center">
                {signatureUrl && (
                  <img src={signatureUrl} className="h-10 object-contain mb-1 brightness-200 invert" alt="Firma" />
                )}
                <div className="h-px w-32 mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
                <div className="text-[7px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  DIRECTOR ACADÉMICO
                </div>
                <div className="text-[9px] font-black text-white">{repName}</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-10 mb-1" />
                <div className="h-px w-32 mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
                <div className="text-[7px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  REPRESENTANTE LEGAL
                </div>
                <div className="text-[9px] font-black text-white">{repName}</div>
              </div>
            </div>

            {/* Footer line */}
            <div className="text-center mt-5">
              <div className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {settings?.lema ? `${settings.lema}  ·  ` : ''}{verificationUrl}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── TEMPLATE "classic" — Foto 3: Franja Superior ─────────────────────────────
  if (templateId === 'classic') {
    return (
      <div
        id={`cert-${enrollment.id}`}
        className="w-[794px] h-[1123px] flex flex-col font-sans shadow-2xl mx-auto my-0 printable-area overflow-hidden"
      >
        {/* ─ TOP DARK HEADER ─ */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden shrink-0"
             style={{ backgroundColor: NAVY, height: '370px' }}>

          {/* Decorative circles */}
          <div className="absolute -left-16 top-1/2 -translate-y-1/2 h-52 w-52 rounded-full pointer-events-none"
               style={{ border: `2px solid rgba(125,194,64,0.18)` }} />
          <div className="absolute -right-10 top-1/4 h-40 w-40 rounded-full pointer-events-none"
               style={{ border: `2px solid rgba(255,255,255,0.08)` }} />

          {/* Tiny org text */}
          <div className="absolute top-5 left-0 right-0 text-center">
            <span className="text-[7px] tracking-[0.3em] uppercase"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
              {orgName} · OTEC ACREDITADO SENCE
            </span>
          </div>

          {/* Main title */}
          <div className="text-[84px] font-black text-white leading-none tracking-tight pb-1">CERTIFI</div>
          <div className="text-[84px] font-black leading-none tracking-tight" style={{ color: GREEN }}>CADO</div>
          <div className="text-[10px] font-bold tracking-[0.5em] mt-2"
               style={{ color: 'rgba(255,255,255,0.4)' }}>DE APROBACIÓN</div>

          {/* Green diagonal stripe */}
          <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: '44px' }}>
            <div style={{
              width: '110%',
              height: '36px',
              backgroundColor: GREEN,
              transform: 'skewY(-1.8deg)',
              transformOrigin: 'left',
              marginTop: '16px',
              marginLeft: '-5%',
            }} />
          </div>
        </div>

        {/* ─ WHITE BODY ─ */}
        <div className="flex-1 bg-white flex flex-col px-12 pt-10 pb-6 overflow-hidden">

          {/* Participant block */}
          <div className="border-l-4 pl-5 mb-7" style={{ borderColor: GREEN }}>
            <div className="text-[8px] font-black uppercase tracking-widest mb-1"
                 style={{ color: '#94a3b8' }}>PARTICIPANTE</div>
            <div className="text-[29px] font-black leading-tight" style={{ color: NAVY }}>
              {enrollment.studentName}
            </div>
            <div className="text-[8px] font-black uppercase tracking-widest mt-2 mb-1"
                 style={{ color: '#94a3b8' }}>PROGRAMA FORMATIVO</div>
            <div className="text-base font-black leading-snug" style={{ color: GREEN }}>
              {courseName}
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-3 gap-4 mb-7">
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: NAVY }}>
              <div className="text-[30px] font-black leading-none mb-0.5" style={{ color: GREEN }}>
                {hours ?? '—'}
              </div>
              <div className="text-[7px] font-black uppercase tracking-widest text-white">HORAS LECTIVAS</div>
              <div className="text-[7px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Duración total del programa</div>
            </div>
            <div className="rounded-xl p-4 text-center border-2" style={{ borderColor: GREEN }}>
              <div className="text-sm font-black mb-0.5" style={{ color: NAVY }}>E-Learning</div>
              <div className="text-[7px] font-black uppercase tracking-widest" style={{ color: GREEN }}>MODALIDAD</div>
              <div className="text-[7px] mt-0.5" style={{ color: '#94a3b8' }}>Aula Virtual</div>
            </div>
            <div className="rounded-xl p-4 text-center border-t-4" style={{ borderColor: ORANGE }}>
              <div className="text-sm font-black mb-0.5" style={{ color: NAVY }}>{emisionDate}</div>
              <div className="text-[7px] font-black uppercase tracking-widest" style={{ color: ORANGE }}>FECHA EMISIÓN</div>
              <div className="text-[7px] mt-0.5" style={{ color: '#94a3b8' }}>
                N.° {enrollment.id.slice(0, 8).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-[11px] italic text-center leading-relaxed mb-6 max-w-lg mx-auto"
             style={{ color: '#94a3b8' }}>
            {course.description ||
             'El presente certificado acredita la aprobación del programa formativo en reconocimiento al esfuerzo y dedicación demostrados.'}
          </p>

          <div className="flex-1" />

          {/* Signatures */}
          <div className="flex items-end justify-between mb-5">
            <div className="flex flex-col items-start">
              {signatureUrl && (
                <img src={signatureUrl} className="h-10 object-contain mb-1" alt="Firma" />
              )}
              <div className="h-px w-36 mb-1" style={{ backgroundColor: '#e2e8f0' }} />
              <div className="text-[7px] uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                DIRECTOR ACADÉMICO
              </div>
              <div className="text-[9px] font-black" style={{ color: NAVY }}>{repName}</div>
            </div>

            {/* Stamp */}
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 rounded-full flex items-center justify-center"
                   style={{ border: '2px dashed rgba(27,47,91,0.2)' }}>
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} className="h-10 w-10 object-contain rounded-full" alt="" />
                ) : (
                  <span className="text-[7px] font-black uppercase text-center leading-tight"
                        style={{ color: 'rgba(27,47,91,0.3)' }}>{initials}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end">
              <div className="h-10 mb-1" />
              <div className="h-px w-36 mb-1" style={{ backgroundColor: '#e2e8f0' }} />
              <div className="text-[7px] uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                REPRESENTANTE LEGAL
              </div>
              <div className="text-[9px] font-black" style={{ color: NAVY }}>{repName}</div>
            </div>
          </div>

          {/* Footer bar */}
          <div className="rounded-xl px-6 py-2.5 text-center" style={{ backgroundColor: '#f8fafc' }}>
            <span className="text-[8px] font-mono" style={{ color: '#94a3b8' }}>
              {settings?.lema ? `${settings.lema}  ·  ` : ''}{verificationUrl}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── DEFAULT "modern" — Foto 1: Panel Lateral ─────────────────────────────────
  return (
    <div
      id={`cert-${enrollment.id}`}
      className="w-[794px] h-[1123px] flex overflow-hidden font-sans shadow-2xl mx-auto my-0 printable-area"
    >
      {/* ─ LEFT SIDEBAR ─ */}
      <div className="shrink-0 flex flex-col py-9 px-6 overflow-hidden"
           style={{ width: '220px', backgroundColor: NAVY }}>

        {/* Logo circle */}
        <div className="flex justify-center mb-5">
          <div className="h-[72px] w-[72px] rounded-full flex flex-col items-center justify-center"
               style={{ border: `2px solid ${GREEN}` }}>
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} className="h-12 w-12 object-contain rounded-full" alt="Logo" />
            ) : (
              <>
                <span className="text-2xl font-black text-white leading-none">{initials}</span>
                <span className="text-[6px] font-black uppercase tracking-widest mt-0.5"
                      style={{ color: GREEN }}>OTEC SENCE</span>
              </>
            )}
          </div>
        </div>

        {/* Org name */}
        <div className="text-center mb-5">
          <div className="text-[9px] font-black text-white uppercase tracking-widest leading-snug">{orgName}</div>
          {orgRut && (
            <div className="text-[7px] mt-0.5" style={{ color: GREEN }}>{orgRut}</div>
          )}
        </div>

        <div className="h-px mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />

        {/* Info sections */}
        <div className="space-y-4 flex-1">
          {hours && (
            <div className="text-center">
              <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5"
                   style={{ color: 'rgba(255,255,255,0.4)' }}>DURACIÓN</div>
              <div className="text-[38px] font-black leading-none" style={{ color: GREEN }}>{hours}</div>
              <div className="text-[7px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>HORAS</div>
            </div>
          )}

          <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

          <div className="text-center">
            <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5"
                 style={{ color: 'rgba(255,255,255,0.4)' }}>MODALIDAD</div>
            <div className="text-[11px] font-black text-white">E-Learning</div>
            <div className="text-[8px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Aula Virtual</div>
          </div>

          <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

          <div className="text-center">
            <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5"
                 style={{ color: 'rgba(255,255,255,0.4)' }}>EMISIÓN</div>
            <div className="text-[11px] font-bold text-white">{emisionDate}</div>
          </div>

          {settings?.lema && (
            <>
              <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <div className="text-center">
                <div className="text-[7px] font-bold uppercase tracking-widest mb-1"
                     style={{ color: 'rgba(255,255,255,0.4)' }}>CONTACTO</div>
                <div className="text-[8px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {settings.lema}
                </div>
              </div>
            </>
          )}
        </div>

        {/* QR at bottom */}
        <div className="mt-5 rounded-xl p-3 flex flex-col items-center"
             style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
          <div className="bg-white rounded-lg p-1.5">
            <QRCodeSVG value={verificationUrl} size={64} level="M" />
          </div>
          <div className="text-[6px] mt-2 font-mono text-center"
               style={{ color: 'rgba(255,255,255,0.3)' }}>verificar en línea</div>
        </div>
      </div>

      {/* ─ RIGHT CONTENT ─ */}
      <div className="flex-1 bg-white flex flex-col px-10 py-9 overflow-hidden">

        {/* Top label */}
        <div className="text-[8px] uppercase tracking-[0.3em] mb-4" style={{ color: '#94a3b8' }}>
          CERTIFICADO DE APROBACIÓN
        </div>

        {/* Main title */}
        <div className="mb-5">
          <div className="font-black leading-none tracking-tight" style={{ fontSize: '68px', color: NAVY }}>CERTIFI</div>
          <div className="font-black leading-none tracking-tight" style={{ fontSize: '68px', color: GREEN }}>CADO</div>
          <div className="flex space-x-1 mt-3">
            <div className="h-1 w-16 rounded-full" style={{ backgroundColor: GREEN }} />
            <div className="h-1 w-6 rounded-full"  style={{ backgroundColor: ORANGE }} />
            <div className="h-1 w-3 rounded-full"  style={{ backgroundColor: '#e2e8f0' }} />
          </div>
        </div>

        <p className="text-sm italic mb-3" style={{ color: '#94a3b8' }}>
          Certifica que el/la participante
        </p>

        {/* Student name */}
        <div className="font-black leading-tight mb-2" style={{ fontSize: '27px', color: NAVY }}>
          {enrollment.studentName}
        </div>

        <p className="text-sm italic mb-5" style={{ color: '#94a3b8' }}>
          ha completado satisfactoriamente el curso
        </p>

        {/* Course name */}
        <div className="border-l-4 rounded-r-xl px-5 py-4 mb-5"
             style={{ borderColor: GREEN, backgroundColor: 'rgba(125,194,64,0.08)' }}>
          <div className="text-base font-black leading-snug" style={{ color: '#1a5c2a' }}>
            {courseName}
          </div>
        </div>

        {/* Badges */}
        <div className="flex space-x-2 mb-5">
          {course.isSence && (
            <span className="px-3 py-1 text-white text-[9px] font-black uppercase tracking-widest rounded"
                  style={{ backgroundColor: NAVY }}>SENCE</span>
          )}
          <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded border"
                style={{ color: '#64748b', borderColor: '#cbd5e1' }}>ACREDITADO</span>
        </div>

        {/* Description */}
        <p className="text-[11px] leading-relaxed" style={{ color: '#94a3b8' }}>
          {course.description ||
           'Reconociendo el esfuerzo y dedicación demostrados durante el proceso de aprendizaje profesional.'}
        </p>

        <div className="flex-1" />

        {/* Footer */}
        <div className="border-t pt-5" style={{ borderColor: '#f1f5f9' }}>
          <div className="flex items-end justify-between mb-4">

            {/* Stamp */}
            <div className="flex flex-col items-center">
              <div className="h-14 w-14 rounded-full flex items-center justify-center"
                   style={{ border: '2px dashed rgba(27,47,91,0.2)' }}>
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} className="h-9 w-9 object-contain rounded-full" alt="" />
                ) : (
                  <span className="text-[7px] font-black uppercase text-center leading-tight"
                        style={{ color: 'rgba(27,47,91,0.3)' }}>{initials}</span>
                )}
              </div>
            </div>

            {/* Signature */}
            <div className="flex flex-col items-center">
              {signatureUrl && (
                <img src={signatureUrl} className="h-10 object-contain mb-1" alt="Firma" />
              )}
              <div className="h-px w-36 mb-1" style={{ backgroundColor: '#e2e8f0' }} />
              <div className="text-[7px] uppercase tracking-widest"
                   style={{ color: '#94a3b8' }}>REPRESENTANTE LEGAL</div>
              <div className="text-[9px] font-black" style={{ color: '#334155' }}>{repName}</div>
            </div>
          </div>

          {/* Verification */}
          <div className="text-center">
            <div className="text-[7px] uppercase tracking-widest mb-0.5" style={{ color: '#cbd5e1' }}>
              VERIFICA LA AUTENTICIDAD DE ESTE CERTIFICADO
            </div>
            <div className="text-[8px] font-mono" style={{ color: '#94a3b8' }}>{verificationUrl}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Custom DOCX template (unchanged) ─────────────────────────────────────────
function CustomDocxTemplate({
  templateBlob,
  enrollment,
  course,
  settings,
  representative,
  backgroundStyle,
}: {
  templateBlob: ArrayBuffer;
  enrollment: Enrollment;
  course: Course;
  settings: OrganizationSettings | null | undefined;
  representative: Representative | null | undefined;
  backgroundStyle: any;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const renderFilledTemplate = async () => {
      if (!templateBlob || !containerRef.current) return;

      try {
        setRendered(false);
        setError(null);

        const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
          let binary = '';
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          return window.btoa(binary);
        };

        const urlToBase64 = async (url: string): Promise<string> => {
          if (!url) return '';
          try {
            const resp = await fetch(url, { mode: 'cors' });
            const blob = await resp.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch { return ''; }
        };

        const compositeSignatureWithStamp = async (
          signatureBase64: string,
          cfg: { useCustomStamp: boolean; customStampName: string; lema: string; orgName: string; orgRut: string; stampStyle?: string }
        ): Promise<string> => {
          const W = 400, H = 400;
          const canvas = document.createElement('canvas');
          canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d');
          if (!ctx) return signatureBase64;
          ctx.clearRect(0, 0, W, H);
          const cx = W / 2, cy = H / 2;
          const stampColor = '#4338ca';
          const style = cfg.stampStyle || 'circular_double';

          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = stampColor;
          ctx.lineWidth = 2.5;

          if (style === 'square') {
            ctx.beginPath(); ctx.roundRect(cx - 170, cy - 170, 340, 340, 20); ctx.stroke();
          } else if (style === 'oval') {
            ctx.beginPath(); ctx.ellipse(cx, cy, 180, 130, 0, 0, Math.PI * 2); ctx.stroke();
          } else {
            if (style === 'circular_dots') ctx.setLineDash([5, 10]);
            ctx.beginPath(); ctx.arc(cx, cy, 160, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            if (style === 'circular_double') { ctx.beginPath(); ctx.arc(cx, cy, 145, 0, Math.PI * 2); ctx.stroke(); }
            if (style === 'circular_horizontal') { ctx.beginPath(); ctx.moveTo(cx - 150, cy); ctx.lineTo(cx + 150, cy); ctx.stroke(); }
          }

          ctx.globalAlpha = 0.5;
          ctx.fillStyle = stampColor;
          ctx.font = 'bold 24px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const title = (cfg.useCustomStamp ? cfg.customStampName : cfg.orgName).toUpperCase();
          const subText = (cfg.lema || 'CERTIFICACIÓN DIGITAL').toUpperCase();

          if (style === 'oval' || style.startsWith('circular')) {
            const titleR = style === 'oval' ? 140 : 150;
            const arcLen = Math.PI * 0.8;
            const startAngle = -Math.PI / 2 - arcLen / 2;
            for (let i = 0; i < title.length; i++) {
              const angle = startAngle + (i + 0.5) * (arcLen / title.length);
              ctx.save();
              const xO = style === 'oval' ? titleR * 1.2 * Math.cos(angle) : titleR * Math.cos(angle);
              const yO = style === 'oval' ? titleR * 0.9 * Math.sin(angle) : titleR * Math.sin(angle);
              ctx.translate(cx + xO, cy + yO); ctx.rotate(angle + Math.PI / 2);
              ctx.fillText(title[i], 0, 0); ctx.restore();
            }
            const subStart = Math.PI / 2 - arcLen / 2;
            ctx.font = '18px Arial, sans-serif';
            for (let i = 0; i < subText.length; i++) {
              const angle = subStart + (i + 0.5) * (arcLen / subText.length);
              ctx.save();
              const xO = style === 'oval' ? titleR * 1.2 * Math.cos(angle) : titleR * Math.cos(angle);
              const yO = style === 'oval' ? titleR * 0.9 * Math.sin(angle) : titleR * Math.sin(angle);
              ctx.translate(cx + xO, cy + yO); ctx.rotate(angle - Math.PI / 2);
              ctx.fillText(subText[i], 0, 0); ctx.restore();
            }
          } else {
            ctx.font = 'bold 22px Arial, sans-serif'; ctx.fillText(title, cx, cy - 120);
            ctx.font = '16px Arial, sans-serif';      ctx.fillText(subText, cx, cy + 120);
          }

          ctx.globalAlpha = 0.6;
          if (style === 'circular_horizontal') {
            ctx.font = 'bold 18px Arial, sans-serif'; ctx.fillText('FIRMA', cx, cy - 30);
            ctx.font = '14px Arial, sans-serif';      ctx.fillText(cfg.orgRut, cx, cy + 30);
          } else {
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillText(cfg.orgRut, cx, cy + (style === 'square' ? 30 : 0));
          }
          ctx.restore();

          if (signatureBase64 && signatureBase64.length > 10) {
            const sigImg = new Image();
            sigImg.src = signatureBase64;
            await new Promise((resolve) => { sigImg.onload = resolve; sigImg.onerror = resolve; });
            const sigW = 320;
            const sigH = sigW / (sigImg.width / sigImg.height);
            ctx.drawImage(sigImg, cx - sigW / 2, cy - sigH / 2, sigW, sigH);
          }
          return canvas.toDataURL('image/png');
        };

        const rawSignatureBase64 = representative?.signatureUrl ? await urlToBase64(representative.signatureUrl) : '';
        const stampCfg = {
          useCustomStamp: settings?.useCustomStamp || false,
          customStampName: settings?.customStampName || '',
          lema: settings?.lema || '',
          orgName: settings?.name || 'OTEC',
          orgRut: settings?.rut || '',
          stampStyle: settings?.stampStyle || 'circular_double',
        };
        const signatureWithStampBase64 = await compositeSignatureWithStamp(rawSignatureBase64, stampCfg);
        const qrBase64 = '';

        const markerData = {
          EMPRESA_OTEC: settings?.name || '',
          RUT_OTEC: settings?.rut || '',
          RUT_EMPRESA_OTEC: settings?.rut || '',
          NOMBRE_CURSO: course.nameVisible || course.senceData?.nombreCurso || '',
          NOMBRE_ALUMNO: enrollment.studentName,
          RUT_ALUMNO: formatRut(enrollment.studentRut),
          HORAS: course.senceData?.horasActividad?.toString() || '0',
          FECHA_EMISION: course.senceData?.fecEmision
            ? format(new Date(course.senceData.fecEmision), 'dd-MM-yyyy')
            : format(new Date(), 'dd-MM-yyyy'),
          ID_CERTIFICADO: enrollment.id,
          REPRESENTANTE_NOMBRE: representative?.name || '',
          REPRESENTANTE_RUT: representative?.rut || '',
        };

        const response = await fetch('/api/generate-certificate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateBase64: arrayBufferToBase64(templateBlob),
            data: markerData,
            images: { FIRMA: signatureWithStampBase64, FIRMA_OTEC: signatureWithStampBase64, QR: qrBase64, TIMBRE: '' },
          }),
        });

        if (!response.ok) throw new Error('Error al generar vista previa');

        const filledBlob = await response.blob();
        const filledArrayBuffer = await filledBlob.arrayBuffer();

        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';
        await renderAsync(filledArrayBuffer, containerRef.current!, undefined, {
          className: 'docx-viewer',
          inWrapper: false,
          ignoreWidth: false,
          ignoreHeight: false,
        });
        setRendered(true);
      } catch (err: any) {
        console.error('Preview error:', err);
        setError(err.message);
      }
    };

    renderFilledTemplate();
  }, [templateBlob, enrollment.id, course.id, settings, representative]);

  return (
    <div
      id={`cert-${enrollment.id}`}
      className="w-[794px] h-[1123px] bg-white relative overflow-hidden font-sans shadow-2xl mx-auto my-0 printable-area"
    >
      <div ref={containerRef} className="w-full h-full" />
      {!rendered && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cargando Vista Previa...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 p-12 text-center">
          <p className="text-red-500 font-bold uppercase tracking-widest text-[10px]">Error: {error}</p>
        </div>
      )}
    </div>
  );
}

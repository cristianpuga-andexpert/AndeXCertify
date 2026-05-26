import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Course, Enrollment, OrganizationSettings, Representative } from '../../types';
import { format } from 'date-fns';
import { formatRut, cn } from '../../lib/utils';

import { renderAsync } from 'docx-preview';

interface Props {
  course: Course;
  enrollment: Enrollment;
  settings?: OrganizationSettings | null;
  representative?: Representative | null;
  templateId?: string;
  templateBlob?: ArrayBuffer | null;
}

export function CertificateTemplate({ course, enrollment, settings, representative, templateId, templateBlob }: Props) {
  // Fix ERROR 1: Null checks for required data
  if (!enrollment || !course) return null;

  const verificationUrl = `${window.location.origin}/verify/${enrollment.id}`;

  const orgName = settings?.name || 'Laboralcap E.I.R.L';
  const orgRut = settings?.rut || '76.058.374-K';
  const repName = representative?.name || 'Alejandra Arce Núñez';
  const repRut = representative?.rut || '12.691.519-5';
  const signatureUrl = representative?.signatureUrl;

  // Custom background if provided in course
  const backgroundStyle = course.customAssetUrl ? {
    backgroundImage: `url(${course.customAssetUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } : {};

  // If we have a custom template blob and the mode is custom, use it
  if (templateId === 'custom' && templateBlob) {
    return <CustomDocxTemplate 
      templateBlob={templateBlob} 
      enrollment={enrollment}
      course={course}
      settings={settings}
      representative={representative}
      backgroundStyle={backgroundStyle}
    />;
  }

  // Built-in Templates Logic
  if (templateId === 'diploma') {
    return (
      <div id={`cert-${enrollment.id}`} className="w-[1123px] h-[794px] bg-white border-[16px] border-[#009688] p-16 relative overflow-hidden flex flex-col items-center justify-center text-center font-sans printable-area shadow-2xl mx-auto my-0" style={backgroundStyle}>
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#009688] opacity-5 -translate-x-1/2 -translate-y-1/2 rotate-45" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#009688] opacity-5 translate-x-1/2 translate-y-1/2 rotate-45" />
        
        <div className="space-y-8 z-10">
          <div className="text-[#009688] font-serif text-2xl tracking-[0.2em] font-light">DIPLOMA DE EXCELENCIA</div>
          <h1 className="text-7xl font-bold text-gray-900 tracking-tight leading-tight">Certificado de Participación</h1>
          
          <div className="text-lg text-gray-400 mt-12 tracking-widest italic font-serif">Otorgado a:</div>
          <div className="text-5xl font-black text-[#009688] uppercase border-b-4 border-[#ccf2ef] px-12 pb-4 inline-block mt-4">
             {enrollment.studentName}
          </div>
          
          <div className="text-xl text-gray-600 mt-12 font-medium max-w-2xl mx-auto leading-relaxed">
            Por haber completado satisfactoriamente el curso de formación profesional en 
            <span className="font-bold block text-2xl mt-2 text-gray-900 uppercase">{course.nameVisible}</span>
          </div>

          <div className="grid grid-cols-3 w-full mt-24">
             <div className="flex flex-col items-center">
                {signatureUrl && <img src={signatureUrl} alt="Firma" className="h-16 object-contain mb-2" />}
                <div className="border-t border-gray-300 pt-2 w-48 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">
                  {repName}<br/>{repRut}
                </div>
             </div>
             <div className="flex flex-col items-center justify-center">
                <QRCodeSVG value={verificationUrl} size={80} level="M" />
                <div className="text-[10px] text-gray-400 mt-2 font-mono italic">{enrollment.id}</div>
             </div>
             <div className="flex flex-col items-center">
                <div className="h-24 w-24 opacity-80 rotate-12 pointer-events-none flex items-center justify-center mb-2">
                   <div className="border-4 border-double border-[#312e81]/40 rounded-full h-full w-full bg-white/10 backdrop-blur-[1px] p-4 flex flex-col items-center justify-center text-center shadow-[inset_0_0_20px_rgba(49,46,129,0.05)]">
                      <p className="text-[7px] font-black text-[#312e81] uppercase leading-tight">{settings?.useCustomStamp ? settings.customStampName : orgName}</p>
                      <div className="h-px w-full bg-[#312e81]/30 my-1"></div>
                      <p className="text-[5px] text-[#3730a3]/60 font-bold uppercase tracking-tighter">CERTIFICACIÓN</p>
                   </div>
                </div>
                <div className="border-t border-gray-300 pt-2 w-48 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-2">Sello de Validación Digital</div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'classic') {
    return (
      <div id={`cert-${enrollment.id}`} className="w-[1123px] h-[794px] bg-[#fcfcf9] border-[30px] border-[#2c3e50] p-20 relative overflow-hidden flex flex-col items-center text-center font-serif printable-area shadow-2xl mx-auto my-0" style={backgroundStyle}>
        <div className="absolute inset-0 border-[2px] border-[#d4af37] m-4 pointer-events-none" />
        
        <div className="space-y-10 z-10">
          <div className="text-[#b8860b] text-xl tracking-[0.3em] font-medium">RECONOCIMIENTO ACADÉMICO</div>
          <h1 className="text-6xl font-black text-[#2c3e50] uppercase tracking-tighter italic">Diploma Honorífico</h1>
          
          <p className="text-xl text-gray-600 mt-12 max-w-3xl leading-relaxed italic">
            La institución certifica solemnemente que el alumno(a)
          </p>
          
          <div className="text-5xl font-serif text-[#2c3e50] border-b-2 border-gray-200 px-8 pb-3 min-w-[500px]">
             {enrollment.studentName}
          </div>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mt-8">
            ha demostrado excelencia en los estudios integrales sobre:
            <span className="block font-black text-3xl mt-4 text-[#2c3e50] tracking-tight">{course.nameVisible}</span>
          </p>

          <div className="flex justify-around w-full mt-24 items-end">
             <div className="flex flex-col items-center">
                {signatureUrl && <img src={signatureUrl} alt="Firma" className="h-20 object-contain mb-2 grayscale" />}
                <div className="border-t border-gray-400 pt-3 w-64 text-xs text-gray-700 font-bold uppercase tracking-wider">
                  {repName}<br/>Dirección Académica
                </div>
             </div>
             <div className="flex flex-col items-center">
                <QRCodeSVG value={verificationUrl} size={90} level="H" bgColor="#fcfcf9" />
                <div className="text-[10px] text-gray-400 mt-3 font-mono opacity-50">{enrollment.id}</div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'tech') {
    return (
      <div id={`cert-${enrollment.id}`} className="w-[1123px] h-[794px] bg-[#020617] p-20 relative overflow-hidden flex flex-col items-start justify-center font-mono printable-area shadow-2xl mx-auto my-0" style={backgroundStyle}>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-[#10b981]/5 -skew-x-12 translate-x-20" />
        <div className="absolute top-0 right-0 p-12 border-t-[40px] border-r-[40px] border-[#10b981]/20 w-80 h-80" />
        
        <div className="space-y-12 z-10 w-full">
          <div>
            <div className="inline-block px-4 py-1 bg-[#10b981] text-[#020617] text-xs font-black uppercase tracking-tighter mb-4">Verification Level: HIGH</div>
            <h1 className="text-8xl font-black text-white tracking-widest uppercase leading-none italic">Verified<br/><span className="text-[#10b981]">Certificate</span></h1>
          </div>
          
          <div className="space-y-4">
            <div className="text-[#10b981]/50 text-sm font-bold uppercase tracking-[0.5em]">&gt; Subject:</div>
            <div className="text-4xl font-bold text-white uppercase border-l-8 border-[#10b981] pl-8 py-2">
               {course.nameVisible}
            </div>
          </div>

          <div className="flex items-center space-x-12">
            <div>
              <div className="text-[#10b981]/50 text-xs font-bold uppercase tracking-widest mb-1">Holder:</div>
              <div className="text-3xl font-black text-white">{enrollment.studentName}</div>
            </div>
            <div className="h-10 w-px bg-[#1e293b]" />
            <div>
              <div className="text-[#10b981]/50 text-xs font-bold uppercase tracking-widest mb-1">Identity:</div>
              <div className="text-xl font-medium text-[#94a3b8]">{formatRut(enrollment.studentRut)}</div>
            </div>
          </div>

          <div className="flex items-end justify-between w-full pt-12 border-t border-[#0f172a]">
             <div className="space-y-4">
                <div className="flex items-center space-x-6">
                   {signatureUrl && <img src={signatureUrl} alt="Firma" className="h-12 object-contain invert brightness-200" />}
                   <div>
                      <div className="text-[#10b981] text-[10px] font-black uppercase">{repName}</div>
                      <div className="text-[#475569] text-[8px] font-bold uppercase tracking-widest">Authority Signer HL-9</div>
                   </div>
                </div>
                <div className="text-[10px] text-[#334155] max-w-sm">
                   CERTIFIED BY {orgName.toUpperCase()} PROTOCOL V4.2.0. SECURED WITH BLOCKCHAIN-READY VALIDATION HASH.
                </div>
             </div>
             <div className="flex flex-col items-end">
                <div className="p-2 bg-white rounded-lg">
                  <QRCodeSVG value={verificationUrl} size={100} level="M" />
                </div>
                <div className="text-[10px] text-[#10b981] mt-4 font-mono font-black animate-pulse tracking-tighter">AUTHENTICATION ID: {enrollment.id}</div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'minimal') {
    return (
      <div id={`cert-${enrollment.id}`} className="w-[794px] h-[1123px] bg-white p-24 relative overflow-hidden flex flex-col font-sans printable-area shadow-2xl mx-auto my-0" style={backgroundStyle}>
        <div className="h-1 w-24 bg-black mb-12" />
        
        <div className="space-y-16 flex-1">
          <div className="space-y-4">
            <h1 className="text-6xl font-light text-[#0f172a] tracking-tighter">Reconocimiento<br/><span className="font-black italic">Académico</span></h1>
            <p className="text-[#94a3b8] text-lg font-medium tracking-tight">Emitido de acuerdo a los protocolos institucionales de formación.</p>
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-[#cbd5e1] tracking-[0.2em]">Candidato</span>
              <div className="text-5xl font-black text-[#0f172a] tracking-tight leading-none">{enrollment.studentName}</div>
              <div className="text-lg text-[#64748b] font-mono italic">{formatRut(enrollment.studentRut)}</div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-[#cbd5e1] tracking-[0.2em]">Formación</span>
              <div className="text-2xl font-bold text-[#0f172a] tracking-tight uppercase leading-snug">{course.nameVisible}</div>
            </div>
          </div>

          <p className="text-[#475569] text-sm italic font-medium leading-relaxed max-w-md">
            Este documento formaliza la aprobación integral de los contenidos impartidos por {orgName} durante el periodo lectivo vigente.
          </p>
        </div>

        <div className="flex items-end justify-between pt-12 border-t border-[#f1f5f9]">
           <div className="space-y-6">
              <div className="flex items-center space-x-6">
                 {signatureUrl && <img src={signatureUrl} alt="Firma" className="h-14 object-contain opacity-80" />}
                 <div>
                    <div className="text-[#0f172a] text-[11px] font-black uppercase leading-none">{repName}</div>
                    <div className="text-[#94a3b8] text-[9px] font-bold uppercase mt-1 tracking-widest">{repRut}</div>
                 </div>
              </div>
              <div className="text-[8px] text-[#cbd5e1] font-black uppercase tracking-[0.2em]">Validado por {orgName}</div>
           </div>
           <div className="flex flex-col items-end">
              <QRCodeSVG value={verificationUrl} size={80} level="M" />
              <div className="text-[9px] text-[#cbd5e1] mt-2 font-mono">{enrollment.id}</div>
           </div>
        </div>
      </div>
    );
  }

  // SENCE / Standard Certificate Template (Default)
  return (
    <div id={`cert-${enrollment.id}`} className="w-[794px] h-[1123px] bg-white p-12 relative font-sans shadow-xl border border-gray-100 mx-auto my-0 printable-area overflow-hidden" style={backgroundStyle}>
      <div className="border-2 border-black flex flex-col h-full">
        {/* Header content ... same as before */}
        <div className="border-b-2 border-black p-4 flex justify-between items-start">
          <div className="h-16 w-32 border border-gray-300 flex items-center justify-center overflow-hidden bg-[#f8fafc]">
             {settings?.logoUrl ? (
               <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain" />
             ) : (
               <span className="text-[10px] font-bold text-gray-400 italic text-center p-2">LOGO {orgName.slice(0, 10).toUpperCase()}</span>
             )}
          </div>
          <div className="text-center flex-1 mx-4">
            <h2 className="text-[11px] font-bold leading-tight uppercase px-4 py-2">
              Certificado de Asistencia Actividad OTEC, CFT o Entidad Niveladora de Estudios, 
              Imputada en forma total o parcial a franquicia tributaria de capacitación
            </h2>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-6">
          <div className="flex justify-center space-x-8 text-sm font-bold">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 border-2 border-black flex items-center justify-center">X</div>
              <span className="text-xs uppercase tracking-tighter">Actividad dentro del año calendario</span>
            </div>
          </div>

          <div className="text-[10px] text-center leading-relaxed italic px-8 text-[#475569]">
            Se extiende el presente certificado de asistencia correspondiente a la actividad de capacitación que a continuación se señala:
          </div>

          <table className="w-full border-collapse border-y-2 border-black text-[10px]">
            <tbody>
              <tr>
                <td className="border-r border-b border-black p-2 font-bold w-1/2 bg-[#f8fafc] uppercase tracking-tighter">Razón social OTEC, CFT o entidad niveladora</td>
                <td className="border-b border-black p-2 uppercase font-medium">{settings?.name || course.senceData?.empresa || 'Laboralcap E.I.R.L'}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-2 font-bold bg-[#f8fafc] uppercase tracking-tighter">RUT OTEC, CFT o entidad niveladora</td>
                <td className="border-b border-black p-2 font-mono">{orgRut}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-2 font-bold bg-[#f8fafc] uppercase tracking-tighter">Razón social empresa cliente</td>
                <td className="border-b border-black p-2 uppercase font-medium">{course.senceData?.empresa || '-'}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-2 font-bold bg-[#f8fafc] uppercase tracking-tighter">RUT empresa cliente</td>
                <td className="border-b border-black p-2 font-mono">{course.senceData?.rutEmpresa || '-'}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-2 font-bold bg-[#f8fafc] uppercase tracking-tighter">Nombre de la actividad</td>
                <td className="border-b border-black p-2 font-black uppercase text-sm">{course.nameVisible}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-2 font-bold bg-[#f8fafc] uppercase tracking-tighter">Fecha inicio / término</td>
                <td className="border-b border-black p-2 font-medium">
                  {course.senceData?.fecInicio ? format(new Date(course.senceData.fecInicio), 'dd-MM-yyyy') : '-'} al {course.senceData?.fecTermino ? format(new Date(course.senceData.fecTermino), 'dd-MM-yyyy') : '-'}
                </td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-2 font-bold bg-[#f8fafc] uppercase tracking-tighter">Nº de horas cronológicas</td>
                <td className="border-b border-black p-2 font-bold">{course.senceData?.horasActividad || 0} Horas</td>
              </tr>
            </tbody>
          </table>

          {/* Participant Table */}
          <div className="space-y-1">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 mb-2 text-[#94a3b8] font-mono">Dato Individual de Alumno:</div>
             <table className="w-full border-collapse border-2 border-black text-[10px] text-center">
                <thead className="bg-[#f0f0f0]">
                   <tr>
                      <th className="border border-black p-2 w-8 tracking-tighter">POS</th>
                      <th className="border border-black p-2 uppercase tracking-tighter">RUT ALUMNO</th>
                      <th className="border border-black p-2 text-left uppercase tracking-tighter">Nombre Completo Alumno</th>
                      <th className="border border-black p-2 w-16 tracking-tighter">EV. FINAL</th>
                      <th className="border border-black p-2 w-20 tracking-tighter">ESTADO</th>
                      <th className="border border-black p-2 w-16 tracking-tighter">% ASIST.</th>
                   </tr>
                </thead>
                <tbody>
                   <tr className="bg-white">
                      <td className="border border-black p-2">1</td>
                      <td className="border border-black p-2 font-mono">{formatRut(enrollment.studentRut)}</td>
                      <td className="border border-black p-2 text-left font-black uppercase leading-none">{enrollment.studentName}</td>
                      <td className="border border-black p-2 font-bold">{enrollment.evaluation || '6.5'}</td>
                      <td className="border border-black p-2 uppercase font-black">{enrollment.status}</td>
                      <td className="border border-black p-2 font-bold">{enrollment.attendance || 100}%</td>
                   </tr>
                </tbody>
             </table>
          </div>

          {/* Footer Section */}
          <div className="grid grid-cols-2 gap-12 mt-12">
             <div className="relative">
                <div className="h-28 w-56 border-b-2 border-black flex items-end justify-center pb-2 relative">
                   {signatureUrl && (
                     <img src={signatureUrl} alt="Firma" className="absolute bottom-4 h-24 object-contain z-10" />
                   )}
                   {/* Electronic Stamp */}
                   <div className="absolute -top-6 -right-12 h-36 w-36 opacity-90 rotate-6 pointer-events-none flex items-center justify-center">
                     <svg viewBox="0 0 200 200" className="w-full h-full text-[#4338ca]/30">
                        {/* Main Shapes based on style */}
                        {settings?.stampStyle === 'square' ? (
                          <rect x="10" y="10" width="180" height="180" rx="15" fill="white" fillOpacity="0.1" stroke="currentColor" strokeWidth="2.5" />
                        ) : settings?.stampStyle === 'oval' ? (
                          <ellipse cx="100" cy="100" rx="95" ry="70" fill="white" fillOpacity="0.1" stroke="currentColor" strokeWidth="2.5" />
                        ) : (
                          <>
                            <circle cx="100" cy="100" r="95" fill="white" fillOpacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeDasharray={settings?.stampStyle === 'circular_dots' ? "4 4" : "none"} />
                            {settings?.stampStyle === 'circular_double' && (
                              <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            )}
                            {settings?.stampStyle === 'circular_horizontal' && (
                              <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
                            )}
                          </>
                        )}
                        
                        <defs>
                          <path id="circlePathTop" d="M 25,100 A 75,75 0 0,1 175,100" />
                          <path id="circlePathBottom" d="M 25,100 A 75,75 0 0,0 175,100" />
                          <path id="ovalPathTop" d="M 25,100 A 75,55 0 0,1 175,100" />
                          <path id="ovalPathBottom" d="M 25,100 A 75,55 0 0,0 175,100" />
                        </defs>

                        <text className="fill-[#4338ca] text-[10px] font-black uppercase tracking-tight">
                          <textPath href={settings?.stampStyle === 'oval' ? "#ovalPathTop" : "#circlePathTop"} startOffset="50%" textAnchor="middle">
                            {settings?.useCustomStamp ? (settings.customStampName || 'Nombre Timbre') : (settings?.name || 'Institución')}
                          </textPath>
                        </text>

                        <text className="fill-[#4338ca]/60 text-[8px] font-black uppercase tracking-widest">
                          <textPath href={settings?.stampStyle === 'oval' ? "#ovalPathBottom" : "#circlePathBottom"} startOffset="50%" textAnchor="middle">
                            {settings?.lema || "CERTIFICACIÓN DIGITAL"}
                          </textPath>
                        </text>

                        <text x="100" y={settings?.stampStyle === 'circular_horizontal' ? "92" : "105"} textAnchor="middle" className="fill-[#4338ca] text-[10px] font-black">
                          {settings?.stampStyle === 'circular_horizontal' ? 'FIRMA' : (settings?.rut || '76.XXX.XXX-X')}
                        </text>
                        {settings?.stampStyle === 'circular_horizontal' && (
                          <text x="100" y="112" textAnchor="middle" className="fill-[#4338ca]/40 text-[8px] font-bold">
                            {settings?.rut || '76.XXX.XXX-X'}
                          </text>
                        )}
                        <text x="100" y="145" textAnchor="middle" className="fill-[#a5b4fc] text-[5px] font-mono uppercase tracking-[0.3em] font-black">{enrollment.id.slice(0, 10)}</text>
                     </svg>
                   </div>
                </div>
                <div className="text-[9px] mt-4 font-black leading-tight uppercase text-[#1e293b]">
                   Firma representante legal OTEC<br/>
                   <span className="text-[#64748b] font-bold mt-1 inline-block">{repName} / {repRut}</span>
                </div>
             </div>
             <div className="flex flex-col items-center justify-center">
                <div className="p-2 border border-[#f1f5f9] rounded-xl shadow-sm bg-[#f8fafc]/50">
                   <QRCodeSVG value={verificationUrl} size={110} level="M" />
                </div>
                <div className="text-[8px] mt-2 text-[#94a3b8] font-mono italic">ID Cert: {enrollment.id}</div>
                <div className="text-[9px] mt-4 font-black bg-[#f1f5f9] px-3 py-1 rounded-full uppercase tracking-tighter">EMISIÓN: {course.senceData?.fecEmision ? format(new Date(course.senceData.fecEmision), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy')}</div>
             </div>
          </div>
        </div>

        {/* Note */}
        <div className="mt-auto p-4 border-t-2 border-black bg-[#f8fafc] text-[8px] italic leading-snug text-[#64748b]">
          Actividad de capacitación financiada, total o parcialmente, a través de la franquicia tributaria de capacitación, administrada por el 
          <b> Servicio Nacional de Capacitación y Empleo (SENCE)</b>. Actividad no conducente al otorgamiento de un título o grado académico. Para verificar la autenticidad, escanee el código QR adjunto.
        </div>
      </div>
    </div>
  );
}

function CustomDocxTemplate({ 
  templateBlob, 
  enrollment, 
  course, 
  settings, 
  representative,
  backgroundStyle 
}: { 
  templateBlob: ArrayBuffer, 
  enrollment: Enrollment,
  course: Course,
  settings: OrganizationSettings | null | undefined,
  representative: Representative | null | undefined,
  backgroundStyle: any
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

        // Helper to convert ArrayBuffer to Base64
        const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return window.btoa(binary);
        };

        // Helper for URL to Base64
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

        // Composite Stamp Logic (Client Side)
        const compositeSignatureWithStamp = async (
          signatureBase64: string,
          cfg: { useCustomStamp: boolean, customStampName: string, lema: string, orgName: string, orgRut: string, stampStyle?: string }
        ): Promise<string> => {
          const W = 400;
          const H = 400;
          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext('2d');
          if (!ctx) return signatureBase64;
          ctx.clearRect(0, 0, W, H);

          const cx = W / 2;
          const cy = H / 2;
          const stampColor = '#4338ca';
          const style = cfg.stampStyle || 'circular_double';

          // --- STAMP DRAWING ---
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = stampColor;
          ctx.lineWidth = 2.5;

          if (style === 'square') {
            const size = 340;
            const radius = 20;
            ctx.beginPath();
            ctx.roundRect(cx - size / 2, cy - size / 2, size, size, radius);
            ctx.stroke();
          } else if (style === 'oval') {
            ctx.beginPath();
            ctx.ellipse(cx, cy, 180, 130, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            if (style === 'circular_dots') ctx.setLineDash([5, 10]);
            ctx.beginPath();
            ctx.arc(cx, cy, 160, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            if (style === 'circular_double') {
              ctx.beginPath();
              ctx.arc(cx, cy, 145, 0, Math.PI * 2);
              ctx.stroke();
            }
            if (style === 'circular_horizontal') {
              ctx.beginPath();
              ctx.moveTo(cx - 150, cy);
              ctx.lineTo(cx + 150, cy);
              ctx.stroke();
            }
          }

          // Top Curved Text
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = stampColor;
          ctx.font = 'bold 24px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const title = (cfg.useCustomStamp ? cfg.customStampName : cfg.orgName).toUpperCase();
          const subText = (cfg.lema || "CERTIFICACIÓN DIGITAL").toUpperCase();
          
          if (style === 'oval' || style.startsWith('circular')) {
            const titleR = style === 'oval' ? 140 : 150;
            const arcLen = Math.PI * 0.8;
            const startAngle = -Math.PI / 2 - arcLen / 2;
            
            for (let i = 0; i < title.length; i++) {
              const angle = startAngle + (i + 0.5) * (arcLen / title.length);
              ctx.save();
              const xOffset = style === 'oval' ? titleR * 1.2 * Math.cos(angle) : titleR * Math.cos(angle);
              const yOffset = style === 'oval' ? titleR * 0.9 * Math.sin(angle) : titleR * Math.sin(angle);
              ctx.translate(cx + xOffset, cy + yOffset);
              ctx.rotate(angle + Math.PI / 2);
              ctx.fillText(title[i], 0, 0);
              ctx.restore();
            }

            const subStartAngle = Math.PI / 2 - arcLen / 2;
            ctx.font = '18px Arial, sans-serif';
            for (let i = 0; i < subText.length; i++) {
                const angle = subStartAngle + (i + 0.5) * (arcLen / subText.length);
                ctx.save();
                const xOffset = style === 'oval' ? titleR * 1.2 * Math.cos(angle) : titleR * Math.cos(angle);
                const yOffset = style === 'oval' ? titleR * 0.9 * Math.sin(angle) : titleR * Math.sin(angle);
                ctx.translate(cx + xOffset, cy + yOffset);
                ctx.rotate(angle - Math.PI / 2);
                ctx.fillText(subText[i], 0, 0);
                ctx.restore();
            }
          } else {
            ctx.font = 'bold 22px Arial, sans-serif';
            ctx.fillText(title, cx, cy - 120);
            ctx.font = '16px Arial, sans-serif';
            ctx.fillText(subText, cx, cy + 120);
          }

          // Center Text
          ctx.globalAlpha = 0.6;
          if (style === 'circular_horizontal') {
            ctx.font = 'bold 18px Arial, sans-serif';
            ctx.fillText('FIRMA', cx, cy - 30);
            ctx.font = '14px Arial, sans-serif';
            ctx.fillText(cfg.orgRut, cx, cy + 30);
          } else {
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillText(cfg.orgRut, cx, cy + (style === 'square' ? 30 : 0));
          }
          ctx.restore();

          // --- SIGNATURE DRAWING ---
          if (signatureBase64 && signatureBase64.length > 10) {
            const sigImg = new Image();
            sigImg.src = signatureBase64;
            await new Promise((resolve) => {
              sigImg.onload = resolve;
              sigImg.onerror = resolve;
            });
            const sigW = 320;
            const sigH = sigW / (sigImg.width / sigImg.height);
            ctx.drawImage(sigImg, cx - sigW / 2, cy - sigH / 2, sigW, sigH);
          }

          return canvas.toDataURL('image/png');
        };

        // Prepare Images
        const rawSignatureBase64 = representative?.signatureUrl ? await urlToBase64(representative.signatureUrl) : '';
        const stampCfg = {
          useCustomStamp: settings?.useCustomStamp || false,
          customStampName: settings?.customStampName || '',
          lema: settings?.lema || '',
          orgName: settings?.name || 'OTEC',
          orgRut: settings?.rut || '',
          stampStyle: settings?.stampStyle || 'circular_double'
        };
        const signatureWithStampBase64 = await compositeSignatureWithStamp(rawSignatureBase64, stampCfg);

        // QR Base64 (simple manual generation for preview if needed, or just placeholder)
        // Here we'll just use a blank placeholder if needed, but in reality we'd use qrcode library
        // actually we already have QRCodeSVG in the parent, but we need it as image for the server.
        // For simplicity in preview, we might just skip the QR or send a static one.
        // Let's at least try to get the QR from the hidden element if it exists.
        const qrBase64 = ''; 

        const markerData = {
          EMPRESA_OTEC: settings?.name || 'Laboralcap E.I.R.L',
          RUT_OTEC: settings?.rut || '76.058.374-K',
          RUT_EMPRESA_OTEC: settings?.rut || '76.058.374-K',
          NOMBRE_CURSO: course.nameVisible || course.senceData?.nombreCurso || '',
          NOMBRE_ALUMNO: enrollment.studentName,
          RUT_ALUMNO: formatRut(enrollment.studentRut),
          HORAS: course.senceData?.horasActividad?.toString() || '0',
          FECHA_EMISION: course.senceData?.fecEmision ? format(new Date(course.senceData.fecEmision), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy'),
          ID_CERTIFICADO: enrollment.id,
          REPRESENTANTE_NOMBRE: representative?.name || 'Alejandra Arce Núñez',
          REPRESENTANTE_RUT: representative?.rut || '12.691.519-5'
        };

        const response = await fetch('/api/generate-certificate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateBase64: arrayBufferToBase64(templateBlob),
            data: markerData,
            images: {
              FIRMA: signatureWithStampBase64,
              FIRMA_OTEC: signatureWithStampBase64,
              QR: qrBase64,
              TIMBRE: ''
            }
          })
        });

        if (!response.ok) throw new Error('Error al generar vista previa');

        const filledBlob = await response.blob();
        const filledArrayBuffer = await filledBlob.arrayBuffer();

        if (!containerRef.current) {
          console.warn("Container ref is null, skipping preview render");
          return;
        }
        
        try {
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
          
          if (typeof renderAsync === 'undefined') {
             throw new Error("docx-preview library not loaded");
          }

          await renderAsync(filledArrayBuffer, containerRef.current!, undefined, {
            className: "docx-viewer",
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
          });
          setRendered(true);
        } catch (renderErr: any) {
          console.error("Error during docx renderAsync:", renderErr);
          throw new Error("Failed to render preview: " + renderErr.message);
        }
      } catch (err: any) {
        console.error("Preview error:", err);
        setError(err.message);
      }
    };

    renderFilledTemplate();
  }, [templateBlob, enrollment.id, course.id, settings, representative]);

  return (
    <div 
      id={`cert-${enrollment.id}`} 
      className="w-[794px] h-[1123px] bg-white relative overflow-hidden font-sans shadow-2xl mx-auto my-0 printable-area"
      style={backgroundStyle}
    >
      <div 
        ref={containerRef}
        className="w-full h-full"
      />
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


import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Save,
  Trash2,
  Upload,
  AlertCircle,
  CheckCircle2,
  Plus,
  Award,
  Palette,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { OrganizationSettings } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import {
  applyBrandColor,
  extractDominantColors,
  DEFAULT_BRAND_COLOR,
  darkenHex,
} from '../lib/colorUtils';

export function SettingsInstitutional() {
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
    brandColor: undefined,
    updatedAt: new Date().toISOString(),
  });
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    api.get<OrganizationSettings>('/api/settings')
      .then((settings) => {
        if (settings && Object.keys(settings).length > 0) {
          setOrgSettings({
            ...settings,
            lema: settings.lema || '',
            useCustomStamp: !!settings.useCustomStamp,
            customStampName: settings.customStampName || '',
            stampStyle: settings.stampStyle || 'circular_double',
            logoUrl: settings.logoUrl || '',
            brandColor: settings.brandColor,
          });
          // Extract colors from existing logo
          if (settings.logoUrl) {
            setExtracting(true);
            extractDominantColors(settings.logoUrl)
              .then(setDetectedColors)
              .finally(() => setExtracting(false));
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleOrgSave = async () => {
    if (!user) return;
    try {
      const saved = await api.put<OrganizationSettings>('/api/settings', orgSettings);
      setOrgSettings(saved);
      // Re-apply color in case it was changed
      applyBrandColor(saved.brandColor);
      setShowSavedMsg(true);
      setTimeout(() => setShowSavedMsg(false), 3000);
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      let base64 = reader.result as string;
      if (base64.length > 800000) {
        const img = new Image();
        img.src = base64;
        await new Promise(r => { img.onload = r; });
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 800;
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
      setOrgSettings(prev => ({ ...prev, logoUrl: base64 }));

      // Auto-extract colors from the new logo
      setExtracting(true);
      setDetectedColors([]);
      extractDominantColors(base64)
        .then((colors) => {
          setDetectedColors(colors);
          // Auto-apply the most dominant color if no custom color is set yet
          if (colors.length > 0) {
            handleColorSelect(colors[0]);
          }
        })
        .finally(() => setExtracting(false));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    if (confirm('¿Está seguro de eliminar el logo institucional?')) {
      setOrgSettings(prev => ({ ...prev, logoUrl: '' }));
      setDetectedColors([]);
    }
  };

  const handleColorSelect = (color: string) => {
    setOrgSettings(prev => ({ ...prev, brandColor: color }));
    applyBrandColor(color); // live preview
  };

  const handleResetColor = () => {
    handleColorSelect(DEFAULT_BRAND_COLOR);
  };

  const activeColor = orgSettings.brandColor || DEFAULT_BRAND_COLOR;

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
        <span className="text-[10px] font-black text-brand uppercase tracking-widest">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-6">

      {/* ── Header ── */}
      <header>
        <div className="flex items-center space-x-2 text-[10px] font-bold text-brand uppercase tracking-[0.2em] mb-2">
          <div className="h-1 w-1 rounded-full bg-brand animate-pulse" />
          <span>Configuración Global</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
          Configuración <span className="text-brand">Institucional</span>
        </h1>
      </header>

      {/* ── Sección 1: Identidad Corporativa ── */}
      <section className="card-base">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-3">
          <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-brand" />
          </div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Identidad Corporativa</h2>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-8 items-start">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <label className="relative group cursor-pointer">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <div className="h-36 w-36 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden group-hover:border-brand group-hover:bg-indigo-50/50 transition-all">
                {orgSettings.logoUrl ? (
                  <div className="relative h-full w-full group/logo">
                    <img src={orgSettings.logoUrl} alt="Logo" className="h-full w-full object-contain p-3" />
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveLogo(); }}
                      className="absolute top-1.5 right-1.5 bg-white/90 text-red-500 p-1 rounded-lg opacity-0 group-hover/logo:opacity-100 transition-opacity shadow-sm hover:bg-red-50"
                      title="Eliminar logo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-7 w-7 text-slate-300 group-hover:text-brand transition-colors" />
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Subir logo</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 bg-brand text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="h-3 w-3" />
              </div>
            </label>
            <p className="text-[8px] font-bold text-slate-400 text-center leading-relaxed">
              Logo institucional<br />PNG / JPG · Máx. 2 MB
            </p>
          </div>

          {/* Campos */}
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Nombre de la OTEC / Entidad
              </label>
              <input
                type="text"
                value={orgSettings.name}
                onChange={(e) => setOrgSettings(prev => ({ ...prev, name: e.target.value }))}
                className="input-base text-sm font-bold"
                placeholder="Andexpert Solutions SpA"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                RUT Institucional
              </label>
              <input
                type="text"
                value={orgSettings.rut}
                onChange={(e) => setOrgSettings(prev => ({ ...prev, rut: e.target.value }))}
                className="input-base text-sm font-mono"
                placeholder="76.000.000-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Sección 2: Color Corporativo ── */}
      <section className="card-base">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            style={{ backgroundColor: `${activeColor}18` }}>
            <Palette className="h-4 w-4" style={{ color: activeColor }} />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Color Corporativo</h2>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">
              Define el color principal de la aplicación según tu identidad visual
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Row: color activo + picker manual */}
          <div className="flex flex-wrap items-start gap-6">

            {/* Color activo */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Color Activo
              </label>
              <div className="flex items-center gap-4">
                {/* Swatch grande */}
                <div
                  className="h-14 w-14 rounded-2xl shadow-lg border-4 border-white ring-1 ring-slate-200 shrink-0 transition-colors duration-300"
                  style={{ backgroundColor: activeColor }}
                />
                <div>
                  <div className="font-mono text-sm font-black text-slate-900 uppercase">
                    {activeColor}
                  </div>
                  <div
                    className="text-[8px] font-black uppercase tracking-widest mt-0.5"
                    style={{ color: darkenHex(activeColor, 20) }}
                  >
                    {activeColor === DEFAULT_BRAND_COLOR ? 'Predeterminado' : 'Personalizado'}
                  </div>
                  {activeColor !== DEFAULT_BRAND_COLOR && (
                    <button
                      onClick={handleResetColor}
                      className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-slate-700 transition-colors mt-1.5"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Restaurar predeterminado
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selector manual */}
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Color personalizado
              </label>
              <button
                onClick={() => colorInputRef.current?.click()}
                className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all group"
              >
                <div
                  className="h-7 w-7 rounded-lg border-2 border-white shadow-md shrink-0 transition-colors duration-200"
                  style={{ backgroundColor: activeColor }}
                />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-900">
                  Elegir color
                </span>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={activeColor}
                  onChange={(e) => handleColorSelect(e.target.value)}
                  className="sr-only"
                />
              </button>
            </div>
          </div>

          {/* Paleta detectada del logo */}
          <AnimatePresence>
            {(detectedColors.length > 0 || extracting) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="space-y-3"
              >
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Colores detectados en el logo
                  {extracting && (
                    <span className="text-brand animate-pulse ml-2">Analizando...</span>
                  )}
                </label>

                {detectedColors.length > 0 && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {detectedColors.map((color, i) => (
                      <motion.button
                        key={color}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => handleColorSelect(color)}
                        title={color}
                        className={cn(
                          'relative h-11 w-11 rounded-xl border-4 shadow-lg transition-all duration-200 hover:scale-110 active:scale-95',
                          activeColor === color
                            ? 'border-slate-900 scale-110 ring-2 ring-offset-2 ring-slate-800'
                            : 'border-white hover:border-slate-200'
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {activeColor === color && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 bg-slate-900 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint si no hay logo */}
          {!orgSettings.logoUrl && (
            <div className="flex items-center gap-2 text-[9px] text-slate-400 font-medium">
              <Zap className="h-3 w-3 text-amber-400" />
              Sube tu logo para detectar automáticamente los colores de tu marca
            </div>
          )}

          {/* Vista previa */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
              Vista Previa en la Interfaz
            </label>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-wrap items-center gap-4">
              {/* Botón primario */}
              <button
                className="px-5 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-lg transition-all"
                style={{
                  backgroundColor: activeColor,
                  boxShadow: `0 8px 24px ${activeColor}40`,
                }}
              >
                Botón Principal
              </button>

              {/* Botón secundario */}
              <button
                className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 bg-white transition-all"
                style={{ borderColor: activeColor, color: activeColor }}
              >
                Secundario
              </button>

              {/* Badge / dot */}
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: activeColor }}>
                  Acento activo
                </span>
              </div>

              {/* Input focus */}
              <div className="flex-1 min-w-[160px]">
                <div
                  className="w-full px-4 py-2.5 bg-white border-2 rounded-xl text-xs font-medium text-slate-600 transition-all"
                  style={{ borderColor: activeColor, boxShadow: `0 0 0 3px ${activeColor}20` }}
                >
                  Input enfocado
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sección 3: Sello Digital ── */}
      <section className="card-base">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
              <Award className="h-4 w-4 text-brand" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Sello Digital</h2>
          </div>
          <button
            onClick={() => setOrgSettings(prev => ({ ...prev, useCustomStamp: !prev.useCustomStamp }))}
            className={cn(
              'flex items-center space-x-2 px-3 py-1.5 rounded-full border-2 transition-all text-[8px] font-black uppercase tracking-widest',
              orgSettings.useCustomStamp
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
            )}
          >
            <span>{orgSettings.useCustomStamp ? 'Personalizado' : 'Estándar'}</span>
            <div className={cn('h-2 w-2 rounded-full', orgSettings.useCustomStamp ? 'bg-emerald-400' : 'bg-slate-300')} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Controles */}
          <div className="space-y-5">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Estilo de Timbre
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'circular_double',     label: 'Doble'  },
                  { id: 'circular_horizontal', label: 'Línea'  },
                  { id: 'circular_dots',       label: 'Puntos' },
                  { id: 'oval',                label: 'Óvalo'  },
                  { id: 'square',              label: 'Cuadro' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setOrgSettings(prev => ({ ...prev, stampStyle: style.id as any }))}
                    className={cn(
                      'flex flex-col items-center p-2 rounded-xl border-2 transition-all',
                      orgSettings.stampStyle === style.id
                        ? 'border-brand bg-indigo-50 text-brand'
                        : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 mb-1 border-2 rounded-sm',
                      style.id === 'circular_double'     && 'rounded-full border-double',
                      style.id === 'circular_horizontal' && 'rounded-full flex flex-col justify-center items-center',
                      style.id === 'circular_dots'       && 'rounded-full border-dotted',
                      style.id === 'oval'                && 'rounded-[100%] w-8',
                      style.id === 'square'              && 'rounded-md'
                    )}>
                      {style.id === 'circular_horizontal' && <div className="w-full h-[1px] bg-current" />}
                    </div>
                    <span className="text-[6px] font-black uppercase">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {orgSettings.useCustomStamp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Nombre en el Timbre
                  </label>
                  <input
                    type="text"
                    value={orgSettings.customStampName}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, customStampName: e.target.value }))}
                    className="input-base text-xs font-bold"
                    placeholder="Nombre para el timbre digital"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Lema (Motto)
              </label>
              <input
                type="text"
                value={orgSettings.lema}
                onChange={(e) => setOrgSettings(prev => ({ ...prev, lema: e.target.value }))}
                className="input-base text-xs"
                placeholder="Excelencia en formación"
              />
            </div>
          </div>

          {/* Preview sello */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center p-6 min-h-[220px]">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Vista previa del timbre
            </span>
            <div className="w-52 h-52">
              <svg viewBox="0 0 200 200" className="w-full h-full text-brand/40">
                {orgSettings.stampStyle === 'square' ? (
                  <rect x="10" y="10" width="180" height="180" rx="15" fill="none" stroke="currentColor" strokeWidth="1.5" />
                ) : orgSettings.stampStyle === 'oval' ? (
                  <ellipse cx="100" cy="100" rx="95" ry="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
                ) : (
                  <>
                    <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeDasharray={orgSettings.stampStyle === 'circular_dots' ? '4 4' : 'none'} />
                    {orgSettings.stampStyle === 'circular_double' && (
                      <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="1" />
                    )}
                    {orgSettings.stampStyle === 'circular_horizontal' && (
                      <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
                    )}
                  </>
                )}
                <defs>
                  <path id="si-circleTop"    d="M 25,100 A 75,75 0 0,1 175,100" />
                  <path id="si-circleBottom" d="M 25,100 A 75,75 0 0,0 175,100" />
                  <path id="si-ovalTop"      d="M 25,100 A 75,55 0 0,1 175,100" />
                  <path id="si-ovalBottom"   d="M 25,100 A 75,55 0 0,0 175,100" />
                </defs>
                <text className="fill-brand/60 font-black uppercase tracking-tight">
                  <textPath
                    href={orgSettings.stampStyle === 'oval' ? '#si-ovalTop' : '#si-circleTop'}
                    startOffset="50%" textAnchor="middle" fontSize="10"
                  >
                    {orgSettings.useCustomStamp
                      ? (orgSettings.customStampName || 'Nombre Timbre')
                      : (orgSettings.name || 'Institución')}
                  </textPath>
                </text>
                <text className="fill-brand/40 font-black uppercase tracking-widest">
                  <textPath
                    href={orgSettings.stampStyle === 'oval' ? '#si-ovalBottom' : '#si-circleBottom'}
                    startOffset="50%" textAnchor="middle" fontSize="8"
                  >
                    {orgSettings.lema || 'CERTIFICACIÓN DIGITAL'}
                  </textPath>
                </text>
                <text
                  x="100"
                  y={orgSettings.stampStyle === 'circular_horizontal' ? '90' : '105'}
                  textAnchor="middle" fontSize="10" className="fill-brand/70 font-black"
                >
                  {orgSettings.stampStyle === 'circular_horizontal' ? 'FIRMA' : (orgSettings.rut || '76.XXX.XXX-X')}
                </text>
                {orgSettings.stampStyle === 'circular_horizontal' && (
                  <text x="100" y="115" textAnchor="middle" fontSize="8" className="fill-brand/40 font-bold">
                    {orgSettings.rut || '76.XXX.XXX-X'}
                  </text>
                )}
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── Guardar ── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
          <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
            Los cambios en identidad, color y sello afectarán los certificados y la interfaz generados a partir de este momento.
          </p>
        </div>
        <button
          onClick={handleOrgSave}
          disabled={showSavedMsg}
          className="btn-primary py-3 px-8 shrink-0 min-w-[180px] justify-center"
        >
          <AnimatePresence mode="wait">
            {showSavedMsg ? (
              <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Guardado</span>
              </motion.div>
            ) : (
              <motion.div key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center space-x-2">
                <Save className="h-4 w-4" />
                <span>Guardar cambios</span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { X, Globe, Check, Copy, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import type { Tenant } from '../pages/SuperAdmin';

interface DnsRecord { type: string; host: string; value: string; }
interface CustomDomainResponse {
  tenant: Tenant;
  dns: { ownership: DnsRecord; routing: DnsRecord };
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</div>
      <button
        onClick={copy}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-800 light:bg-slate-50 border border-white/10 light:border-slate-200 rounded-lg text-left hover:border-brand transition-all group"
      >
        <span className="text-[11px] font-mono text-slate-200 light:text-slate-700 truncate">{value}</span>
        {copied
          ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          : <Copy className="h-3.5 w-3.5 text-slate-500 group-hover:text-brand shrink-0" />}
      </button>
    </div>
  );
}

export function DomainModal({
  tenant, onClose, onSaved,
}: {
  tenant: Tenant;
  onClose: () => void;
  onSaved: (updated: Tenant) => void;
}) {
  const [baseDomain, setBaseDomain] = useState<string>('');
  const [t, setT] = useState<Tenant>(tenant);

  // Subdomain editing
  const [subdomain, setSubdomain] = useState(tenant.subdomain ?? '');
  const [savingSub, setSavingSub] = useState(false);

  // Custom domain
  const [domainInput, setDomainInput] = useState('');
  const [dns, setDns]                 = useState<CustomDomainResponse['dns'] | null>(null);
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState('');
  const [verifyMsg, setVerifyMsg]     = useState('');

  useEffect(() => {
    api.get<{ baseDomain: string }>('/api/public/config')
      .then(c => setBaseDomain(c.baseDomain))
      .catch(() => {});
  }, []);

  const saveSubdomain = async () => {
    setSavingSub(true); setError('');
    try {
      const r = await api.put<{ tenant: Tenant; fullDomain: string }>(
        `/api/admin/tenants/${t.id}/subdomain`, { subdomain });
      setT(r.tenant); onSaved(r.tenant);
    } catch (e: any) { setError(e.message); }
    finally { setSavingSub(false); }
  };

  const registerCustomDomain = async () => {
    setBusy(true); setError(''); setVerifyMsg('');
    try {
      const r = await api.post<CustomDomainResponse>(
        `/api/admin/tenants/${t.id}/custom-domain`, { domain: domainInput });
      setT(r.tenant); setDns(r.dns); onSaved(r.tenant);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const verifyDomain = async () => {
    setBusy(true); setError(''); setVerifyMsg('');
    try {
      const r = await api.post<{ verified: boolean; tenant: Tenant }>(
        `/api/admin/tenants/${t.id}/custom-domain/verify`, {});
      setT(r.tenant); onSaved(r.tenant); setDns(null);
      setVerifyMsg('¡Dominio verificado! El certificado HTTPS se emitirá automáticamente.');
    } catch (e: any) {
      setError(e.message || 'No se pudo verificar. La propagación DNS puede tardar minutos.');
    } finally { setBusy(false); }
  };

  const removeCustomDomain = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.del<{ tenant: Tenant }>(`/api/admin/tenants/${t.id}/custom-domain`);
      setT(r.tenant); onSaved(r.tenant); setDns(null); setDomainInput('');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const fullSubdomain = subdomain && baseDomain ? `${subdomain}.${baseDomain}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-slate-900 light:bg-white border border-white/10 light:border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 light:border-slate-100 sticky top-0 bg-slate-900 light:bg-white z-10">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand" />
            <div>
              <h2 className="text-sm font-black text-white light:text-slate-900">Dominios</h2>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{t.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white light:hover:text-slate-900 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-7">

          {/* ── Subdomain ── */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Subdominio de plataforma
            </h3>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 flex items-center bg-slate-800 light:bg-slate-50 border border-white/10 light:border-slate-200 rounded-xl overflow-hidden focus-within:border-brand">
                <input
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="laboralcap"
                  className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-white light:text-slate-900 text-sm font-mono focus:outline-none"
                />
                <span className="px-3 text-[11px] font-mono text-slate-500 shrink-0">
                  .{baseDomain || '…'}
                </span>
              </div>
              <button onClick={saveSubdomain} disabled={savingSub || !subdomain} className="btn-primary px-4 shrink-0">
                {savingSub ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
              </button>
            </div>
            {fullSubdomain && (
              <p className="text-[10px] text-emerald-400 font-mono mt-2">
                ✓ Disponible en https://{fullSubdomain}
              </p>
            )}
          </section>

          {/* ── Custom domain ── */}
          <section className="border-t border-white/5 light:border-slate-100 pt-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Dominio propio de la OTEC
            </h3>

            {t.customDomain && t.customDomainVerified ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-mono text-emerald-300 truncate">{t.customDomain}</span>
                </div>
                <button onClick={removeCustomDomain} disabled={busy} className="text-slate-500 hover:text-red-400 transition-colors shrink-0" title="Eliminar dominio">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-stretch gap-2">
                  <input
                    value={domainInput || t.customDomain || ''}
                    onChange={e => setDomainInput(e.target.value.toLowerCase())}
                    placeholder="certify.laboralcap.cl"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-slate-800 light:bg-slate-50 border border-white/10 light:border-slate-200 rounded-xl text-white light:text-slate-900 text-sm font-mono focus:outline-none focus:border-brand"
                  />
                  <button onClick={registerCustomDomain} disabled={busy || (!domainInput && !t.customDomain)} className="btn-secondary px-4 shrink-0">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conectar'}
                  </button>
                </div>

                {(dns || (t.customDomain && t.domainVerifyToken)) && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        Crea estos registros en el DNS de la OTEC, luego pulsa <b>Verificar</b>.
                        La propagación puede tardar varios minutos.
                      </p>
                    </div>

                    {dns ? (
                      <div className="space-y-3">
                        <CopyField label="1 · Registro TXT (propiedad)" value={`${dns.ownership.host}  →  ${dns.ownership.value}`} />
                        <CopyField label="2 · Registro CNAME (enrutamiento)" value={`${dns.routing.host}  →  ${dns.routing.value}`} />
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-mono">
                        TXT: _andexcertify-challenge.{t.customDomain} → {t.domainVerifyToken}
                      </p>
                    )}

                    <button onClick={verifyDomain} disabled={busy} className="btn-primary w-full">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar dominio'}
                    </button>
                  </div>
                )}
              </>
            )}
            {verifyMsg && <p className="text-emerald-400 text-xs font-bold mt-3">{verifyMsg}</p>}
          </section>

          {error && (
            <p className={cn('text-red-400 text-xs font-bold')}>{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

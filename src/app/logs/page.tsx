'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Msg = {
  _id: string;
  meta: { messageType?: string; event?: string; controlId?: string };
  firstObx?: { value?: string; units?: string };
  receivedAt: string;
};

type FullMsg = Msg & {
  raw?: string;        // HL7 text
  rawHL7?: string;     // legacy key still supported
  rawMessage?: string; // another possible key
  parsed?: unknown;
};

type ResendResult = {
  ok?: boolean;
  error?: string;
  target?: { host: string; port: number };
  id?: string;
  hasRaw?: boolean;
  payloadPreview?: string;
  bytes?: number;
  ackBytes?: number;
  ackPreview?: string;
  parsed?: { ackCode?: string; ackControlId?: string };
};

const API_BASE = process.env.NEXT_PUBLIC_IM_API_BASE || '';
const MIRTH_HOST = process.env.NEXT_PUBLIC_MIRTH_HOST ?? '127.0.0.1';
const MIRTH_PORT = Number(process.env.NEXT_PUBLIC_MIRTH_PORT ?? 6661);

export default function LogsPage() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // JSON side panel
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<FullMsg | null>(null);

  // Resend drawer
  const [resendOpen, setResendOpen] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendErr, setResendErr] = useState<string | null>(null);
  const [resendOk, setResendOk] = useState<ResendResult | null>(null);

  // Presets from /api/hl7/status
  const [imPreset, setImPreset] = useState<{ host: string; port: number } | null>(null);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/hl7/messages?limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows(await res.json());
    } catch (e: any) {
      setErr(e.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFullMessage(id: string) {
    const res = await fetch(`/api/hl7/messages/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch ${id} failed: ${res.status}`);
    return res.json(); // { _id, raw?, rawHL7?, ... }
  }

  // ✅ HL7-only selector (no JSON fallback)
  function pickHl7Payload(sel?: { raw?: string; rawHL7?: string; rawMessage?: string }): string {
    return (
      (sel?.raw && sel.raw.trim()) ||
      (sel?.rawHL7 && sel.rawHL7.trim()) ||
      (sel?.rawMessage && sel.rawMessage.trim()) ||
      ''
    );
  }

  async function fetchImPreset() {
    try {
      const r = await fetch(`${API_BASE}/api/hl7/status`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j?.status?.host && j?.status?.port) {
        setImPreset({ host: String(j.status.host), port: Number(j.status.port) || 0 });
      }
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    load();
    fetchImPreset();
    const id = setInterval(() => {
      load();
      fetchImPreset();
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const fmt = (ts: string) => new Date(ts).toLocaleString();

  // --- JSON Panel handlers ---
  async function openJson(id: string) {
    setJsonOpen(true);
    setJsonLoading(true);
    setJsonErr(null);
    setSelected(null);
    try {
      const r = await fetch(`${API_BASE}/api/hl7/messages/${id}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const doc: FullMsg = Array.isArray(data) ? data[0] : data;
      setSelected(doc);
    } catch (e: any) {
      setJsonErr(e.message || 'Failed to load JSON');
    } finally {
      setJsonLoading(false);
    }
  }

  function closeJson() {
    setJsonOpen(false);
    setSelected(null);
    setJsonErr(null);
  }

  // --- Resend Drawer state/presets ---
  type PresetKey = 'im' | 'mirth' | 'custom';
  const [preset, setPreset] = useState<PresetKey>('im');
  const [targetHost, setTargetHost] = useState('127.0.0.1');
  const [targetPort, setTargetPort] = useState(2576);

  useEffect(() => {
    if (preset === 'im') {
      if (imPreset) {
        setTargetHost(imPreset.host);
        setTargetPort(imPreset.port);
      } else {
        setTargetHost('127.0.0.1');
        setTargetPort(2575);
      }
    } else if (preset === 'mirth') {
      setTargetHost(MIRTH_HOST);
      setTargetPort(MIRTH_PORT);
    }
    // custom: leave whatever the user typed
  }, [preset, imPreset]);

  const selectedId = selected?._id ?? '';

  // ✅ HL7 payload for drawer preview (escaped)
  const hl7Payload = useMemo(() => {
    const text = pickHl7Payload(selected || undefined);
    return text ? text.replace(/\r/g, '\\r') : '';
  }, [selected]);

  // Small JSON preview (for the JSON drawer header if you want it)
  const selectedPreview = useMemo(() => {
    if (!selected) return '';
    return JSON.stringify(selected).slice(0, 160);
  }, [selected]);

  async function doResend() {
    if (!selectedId) return;
    setResendBusy(true);
    setResendErr(null);
    setResendOk(null);
    try {
      const r = await fetch(`${API_BASE}/api/hl7/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Server retrieves HL7 by id; host/port are user-chosen
        body: JSON.stringify({ id: selectedId, host: targetHost, port: targetPort }),
      });
      const data: ResendResult = await r.json();
      if (!r.ok || data?.error) {
        setResendErr(data?.error || `HTTP ${r.status}`);
      } else {
        setResendOk(data);
      }
    } catch (e: any) {
      setResendErr(e.message || 'Resend failed');
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-4">
        <Link href="/" className="text-sm px-3 py-1 rounded border hover:bg-gray-50">
          ← Back to Dashboard
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <label className="text-sm">
            Limit{' '}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border rounded px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button
            onClick={load}
            className="border rounded px-3 py-1 transition transform active:scale-95"
          >
            Refresh
          </button>
        </div>
      </div>

      {err && <div className="text-red-600 mb-2">Error: {err}</div>}

      <div className="relative">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Control ID</th>
              <th className="text-left p-2">OBX</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-2" colSpan={5}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-2" colSpan={5}>No messages.</td></tr>
            ) : (
              rows.map((m) => (
                <tr key={m._id} className="border-b">
                  <td className="p-2">{fmt(m.receivedAt)}</td>
                  <td className="p-2">{m.meta?.messageType ?? ''}{m.meta?.event ? `^${m.meta.event}` : ''}</td>
                  <td className="p-2">{m.meta?.controlId ?? ''}</td>
                  <td className="p-2">
                    {m.firstObx?.value ?? ''}{m.firstObx?.units ? ` ${m.firstObx.units}` : ''}
                  </td>
                  <td className="p-2">
                    <button
                      className="underline mr-3"
                      onClick={() => openJson(m._id)}
                      title="Open JSON preview"
                    >
                      JSON
                    </button>

                    {/* Resend now fetches full doc first so HL7 payload is available */}
                    <button
                      className="border rounded px-2 py-1 transition transform active:scale-95"
                      onClick={async () => {
                        try {
                          setSelected({ _id: m._id } as any);
                          setResendOk(null);
                          setResendErr(null);

                          const full = await fetchFullMessage(m._id);
                          setSelected(Array.isArray(full) ? full[0] : full);
                          setResendOpen(true);
                        } catch (e: any) {
                          setResendErr(e?.message || 'Failed to load message');
                          setSelected(null);
                          setResendOpen(true); // open drawer so the error is visible
                        }
                      }}
                    >
                      Resend…
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* JSON SLIDE-OVER PANEL */}
        {jsonOpen && (
          <div className="fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={closeJson}
              aria-label="Close JSON"
            />
            <aside className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl p-4 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Message JSON</h3>
                <button
                  onClick={closeJson}
                  className="px-2 py-1 rounded border transition transform active:scale-95"
                >
                  Close
                </button>
              </div>
              {jsonLoading && <div className="text-sm text-slate-500">Loading…</div>}
              {jsonErr && <div className="text-sm text-rose-600">Error: {jsonErr}</div>}
              {!!selected && !jsonLoading && !jsonErr && (
                <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto">
{JSON.stringify(selected, null, 2)}
                </pre>
              )}
            </aside>
          </div>
        )}

        {/* RESEND DRAWER */}
        {resendOpen && (
          <div className="fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setResendOpen(false)}
              aria-label="Close Resend"
            />
            <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl p-4 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Resend HL7</h3>
                <button
                  onClick={() => setResendOpen(false)}
                  className="px-2 py-1 rounded border transition transform active:scale-95"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium mb-1">Target</div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className={`px-2 py-1 rounded border ${preset==='im' ? 'bg-slate-900 text-white' : ''}`}
                      onClick={() => setPreset('im')}
                      title={imPreset ? `${imPreset.host}:${imPreset.port}` : 'IM listener'}
                    >
                      IM Listener
                    </button>
                    <button
                      className={`px-2 py-1 rounded border ${preset==='mirth' ? 'bg-slate-900 text-white' : ''}`}
                      onClick={() => setPreset('mirth')}
                    >
                      Mirth (example)
                    </button>
                    <button
                      className={`px-2 py-1 rounded border ${preset==='custom' ? 'bg-slate-900 text-white' : ''}`}
                      onClick={() => setPreset('custom')}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1">
                    <span className="text-slate-600">Host</span>
                    <input
                      className="border rounded px-2 py-1"
                      value={targetHost}
                      onChange={(e) => setTargetHost(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-slate-600">Port</span>
                    <input
                      className="border rounded px-2 py-1"
                      value={targetPort}
                      onChange={(e) => setTargetPort(Number(e.target.value) || 0)}
                    />
                  </label>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">HL7 payload preview</div>
                  <pre className="text-xs bg-slate-50 border rounded p-2 overflow-auto">
                    {hl7Payload || '(No HL7 payload on this record)'}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={doResend}
                    disabled={!selectedId || resendBusy}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white transition transform active:scale-95 disabled:opacity-60"
                  >
                    {resendBusy ? <span className="inline-flex items-center gap-2"><Spinner/> Sending…</span> : 'Send'}
                  </button>
                  <button
                    onClick={() => { setResendErr(null); setResendOk(null); }}
                    className="px-3 py-2 rounded-xl border transition transform active:scale-95"
                  >
                    Clear
                  </button>
                </div>

                {resendErr && (
                  <div className="text-rose-700 text-sm border border-rose-200 bg-rose-50 rounded p-2">
                    {resendErr}
                  </div>
                )}

                {resendOk && (
                  <div className="text-xs border rounded p-2 space-y-1 bg-emerald-50 border-emerald-200">
                    <div className="font-medium text-emerald-800">Sent ✔</div>
                    <div>Target: {resendOk.target?.host}:{resendOk.target?.port}</div>
                    <div>Bytes: {resendOk.bytes}</div>
                    {resendOk.parsed?.ackCode && (
                      <div>ACK: <b>{resendOk.parsed.ackCode}</b> (MSA-2: {resendOk.parsed.ackControlId || '-'})</div>
                    )}
                    {resendOk.ackPreview && (
                      <details>
                        <summary className="cursor-pointer">ACK Preview</summary>
                        <pre className="bg-white border rounded p-2 overflow-auto">{resendOk.ackPreview}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/** tiny inline spinner (Tailwind only) */
function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4"/>
      <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="4"/>
    </svg>
  );
}

// components/CapServiceTester.tsx
'use client';

import { useState } from 'react';
import { sendCapRequest } from '@/lib/capClient';

export default function CapServiceTester({ url }: { url: string }) {
  const [xml, setXml] = useState('');
  const [soapAction, setSoapAction] = useState('');
  const [resp, setResp] = useState<{ status: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // NEW: creds + auth toggles
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [authMode, setAuthMode] = useState<'digest' | 'text'>('digest');
  const [mustUnderstand, setMustUnderstand] = useState(false);

  async function onSend() {
    if (!xml.trim()) return;
    setBusy(true);
    try {
      const r = await sendCapRequest(xml, {
        url, // ← uses the URL passed from page.tsx
        timeoutMs: 15000,
        headers: soapAction
          ? { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction }
          : { 'Content-Type': 'text/xml; charset=utf-8' },
      });
      setResp(r); // { status, text }
    } catch (e: any) {
      setResp({ status: 0, text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  }

  function onClear() {
    setXml('');
    setResp(null);
  }

  // ===== WS-Security helpers =====
  function toB64(bytes: Uint8Array) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function sha1B64(input: Uint8Array) {
    const buf = await crypto.subtle.digest('SHA-1', input);
    return toB64(new Uint8Array(buf));
  }

  function genNonce(len = 16) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return arr;
  }

  function isoNow() {
    return new Date().toISOString();
  }

  async function buildWsSecurityBlock() {
    const secOpen = mustUnderstand
      ? '<wsse:Security soapenv:mustUnderstand="1">'
      : '<wsse:Security>';

    if (authMode === 'text') {
      return `${secOpen}
      <wsse:UsernameToken>
        <wsse:Username>${user}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${pass}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>`;
    }

    // PasswordDigest
    const nonceBytes = genNonce(16);
    const created = isoNow();
    const enc = new TextEncoder();
    const concat = new Uint8Array(
      nonceBytes.length + enc.encode(created).length + enc.encode(pass).length
    );
    concat.set(nonceBytes, 0);
    concat.set(enc.encode(created), nonceBytes.length);
    concat.set(enc.encode(pass), nonceBytes.length + enc.encode(created).length);

    const passwordDigestB64 = await sha1B64(concat);
    const nonceB64 = toB64(nonceBytes);

    return `${secOpen}
      <wsse:UsernameToken>
        <wsse:Username>${user}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${passwordDigestB64}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonceB64}</wsse:Nonce>
        <wsu:Created>${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>`;
  }

  // Insert a WS-Security-wrapped TestConn body into the payload box
  async function insertWssecTestConn() {
    if (!user || !pass) {
      alert('Enter CAP Username and Password first.');
      return;
    }
    const securityBlock = await buildWsSecurityBlock();
    const built = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:lab2pt="http://lab2pt.pt.cap.org"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <soapenv:Header>
    ${securityBlock}
  </soapenv:Header>
  <soapenv:Body>
    <lab2pt:test_connRequest/>
  </soapenv:Body>
</soapenv:Envelope>`;
    setSoapAction('test_conn');
    setXml(built);
  }
// Insert a WS-Security-wrapped ResultsUpload skeleton into the payload box
async function insertWssecResultsUpload() {
  if (!user || !pass) {
    alert('Enter CAP Username and Password first.');
    return;
  }

  const securityBlock = await buildWsSecurityBlock();

  // NOTE: Skeleton for demo/mock; replace ptdi:* elements with exact CAP XSD fields later.
  const built = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:lab2pt="http://lab2pt.pt.cap.org"
  xmlns:ptdi="http://ptdi.cap.org/common"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <soapenv:Header>
    ${securityBlock}
  </soapenv:Header>
  <soapenv:Body>
    <lab2pt:upload_resultsRequest>
      <!-- ⬇ Replace with real values per CAP XSD/WSDL -->
      <ptdi:lab>
        <ptdi:capNumber>1234567</ptdi:capNumber>
      </ptdi:lab>

      <ptdi:participant>
        <ptdi:capNumber>1234567</ptdi:capNumber>
      </ptdi:participant>

      <ptdi:event>
        <ptdi:programCode>CHEM</ptdi:programCode>
        <ptdi:surveyCode>2025Q3</ptdi:surveyCode>
        <ptdi:kitId>CHEM-001</ptdi:kitId>
      </ptdi:event>

      <ptdi:results>
        <ptdi:result>
          <ptdi:specimenId>1</ptdi:specimenId>
          <ptdi:analyteCode>GLU</ptdi:analyteCode>
          <ptdi:value>92</ptdi:value>
          <ptdi:units>mg/dL</ptdi:units>
          <ptdi:instrumentCode>c502</ptdi:instrumentCode>
          <ptdi:methodCode>HEXOKINASE</ptdi:methodCode>
        </ptdi:result>
      </ptdi:results>
      <!-- ⬆ End demo skeleton -->
    </lab2pt:upload_resultsRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

  setSoapAction('upload_results');   // helpful default
  setXml(built);
}

  return (
    <div className="rounded-2xl border p-3">
      <div className="grid gap-3">

        {/* Credentials */}
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm grid gap-1">
            <span className="text-slate-600">CAP Username</span>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="px-3 py-2 rounded-xl border"
            />
          </label>
          <label className="text-sm grid gap-1">
            <span className="text-slate-600">CAP Password</span>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="px-3 py-2 rounded-xl border"
            />
          </label>
        </div>

        {/* Auth toggles */}
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm grid gap-1">
            <span className="text-slate-600">Auth Mode</span>
            <select
              value={authMode}
              onChange={(e) => setAuthMode(e.target.value as 'digest' | 'text')}
              className="px-3 py-2 rounded-xl border"
            >
              <option value="digest">WS-Security: PasswordDigest</option>
              <option value="text">WS-Security: PasswordText</option>
            </select>
          </label>
          <label className="text-sm inline-flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={mustUnderstand}
              onChange={(e) => setMustUnderstand(e.target.checked)}
            />
            <span>wsse:Security mustUnderstand</span>
          </label>
        </div>

        {/* Helper to drop in a ready payload */}
       <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-xl border"
              onClick={insertWssecTestConn}
              title="Insert a TestConn payload with WS-Security using the selected auth mode"
            >
              Insert TestConn (WS-Security)
            </button>

            <button
              type="button"
              className="px-3 py-2 rounded-xl border"
              onClick={insertWssecResultsUpload}
              title="Insert a ResultsUpload payload skeleton with WS-Security using the selected auth mode"
            >
              Insert ResultsUpload (WS-Security)
            </button>
          </div>


        {/* SOAPAction */}
        <label className="text-sm grid gap-1">
          <span className="text-slate-600">SOAPAction (optional)</span>
          <input
            value={soapAction}
            onChange={(e) => setSoapAction(e.target.value)}
            className="px-3 py-2 rounded-xl border"
            placeholder="e.g., test_conn or ResultsUpload"
          />
        </label>

        {/* Payload */}
        <label className="text-sm grid gap-1">
          <span className="text-slate-600">SOAP/XML Payload</span>
          <textarea
            value={xml}
            onChange={(e) => setXml(e.target.value)}
            rows={10}
            className="w-full border rounded-xl p-3 font-mono text-xs"
            placeholder="Paste SOAP/XML here…"
          />
        </label>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onSend}
            disabled={busy || !xml.trim()}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Send to CAP'}
          </button>
          <button onClick={onClear} className="px-3 py-2 rounded-xl border">Clear</button>
        </div>

        {/* Response */}
        {resp && (
          <div className="mt-2">
            <div className="text-xs text-slate-500 mb-1">HTTP {resp.status}</div>
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto whitespace-pre-wrap max-h-64">
{resp.text}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

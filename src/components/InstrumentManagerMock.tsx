'use client';
import { useState } from 'react';
import RulesIDE from './RulesIDE';
import CapServiceTester from './CapServiceTester';
import { sendCapRequest } from '@/lib/capClient';

// Tabs
const TABS = ['Connections', 'Mappings', 'Rules', 'Results', 'Routing', 'Logs'] as const;
type Tab = typeof TABS[number];

// --- Types & seed data for Connections ---
type ConnStatus = 'Connected' | 'Degraded' | 'Disconnected' | 'Unknown';
type ConnDriver = 'ASTM TCP' | 'HL7 v2 LLP' | 'ASTM Serial' | 'POCT1-A' | 'HTTP(S) SOAP';

interface ConnectionRow {
  id: string;
  name: string;
  driver: ConnDriver;
  status: ConnStatus;
  url?: string; // for HTTP(S) connectors like CAP
}

const INITIAL_CONNECTIONS: ConnectionRow[] = [
  { id: 'sysmex',  name: 'Sysmex XN-1000',            driver: 'ASTM TCP',    status: 'Connected' },
  { id: 'roche',   name: 'Roche cobas c502',          driver: 'HL7 v2 LLP',  status: 'Connected' },
  { id: 'siemens', name: 'Siemens Dimension EXL 200', driver: 'ASTM Serial', status: 'Degraded' },
  { id: 'abbott',  name: 'Abbott i-STAT Alinity',     driver: 'POCT1-A',     status: 'Disconnected' },

  // NEW: CAP service as a first-class connection
  {
    id: 'cap',
    name: 'CAP ResultsUpload',
    driver: 'HTTP(S) SOAP',
    status: 'Unknown',
    url: 'https://access.cap.org/lab2pt/ResultsUpload',
  },
];

export default function InstrumentManagerMock() {
  const [tab, setTab] = useState<Tab>('Rules');

  // connections state + testing state + last CAP response
  const [connections, setConnections] = useState<ConnectionRow[]>(INITIAL_CONNECTIONS);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [lastCapResp, setLastCapResp] = useState<{ status: number; text: string } | null>(null);

  // Handle "Test" action; special handling for CAP via /api/cap proxy
  async function handleTestConnection(row: ConnectionRow) {
    try {
      setTestingId(row.id);

      if (row.id === 'cap') {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <Ping>IM-Mock connectivity test</Ping>
  </soapenv:Body>
</soapenv:Envelope>`;

        // 👇 pass URL / headers / timeout to your /api/cap proxy
        const r = await sendCapRequest(xml, {
          url: row.url,
          headers: {
            // e.g. Authorization: `Bearer ${token}`,
          },
          timeoutMs: 10000, // 10s
        });

        setLastCapResp(r);
        setConnections(connections.map(c =>
          c.id === row.id
            ? { ...c, status: r.status >= 200 && r.status < 400 ? 'Connected' : 'Degraded' }
            : c
        ));
        return;
      }

      // Stub test behavior for non-CAP rows
      setConnections(connections.map(c =>
        c.id === row.id ? { ...c, status: 'Connected' } : c
      ));
    } catch (err) {
      setLastCapResp({ status: 0, text: String((err as Error).message || err) });
      setConnections(connections.map(c =>
        c.id === row.id ? { ...c, status: 'Disconnected' } : c
      ));
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Top nav */}
      <nav className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded ${tab === t ? 'bg-black text-white' : 'bg-gray-200'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Panels */}
      {tab === 'Connections' && (
        <div className="rounded border p-4">
          <h3 className="font-semibold mb-3">Instrument Connections</h3>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Driver</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4">{row.driver}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          row.status === 'Connected'
                            ? 'inline-block px-2 py-0.5 rounded bg-green-100 text-green-800'
                            : row.status === 'Degraded'
                            ? 'inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-800'
                            : row.status === 'Disconnected'
                            ? 'inline-block px-2 py-0.5 rounded bg-red-100 text-red-800'
                            : 'inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-800'
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 flex gap-2">
                      <button className="px-2 py-1 border rounded">Config</button>
                      <button className="px-2 py-1 border rounded">Restart</button>
                      <button
                        onClick={() => handleTestConnection(row)}
                        disabled={testingId === row.id}
                        className="px-2 py-1 border rounded bg-blue-600 text-white disabled:opacity-60"
                      >
                        {testingId === row.id ? 'Testing…' : 'Test'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CAP response viewer (appears after a CAP test) */}
          {lastCapResp && (
            <div className="mt-4">
              <h4 className="font-medium mb-1">CAP Response</h4>
              <div className="text-xs text-gray-600 mb-1">HTTP {lastCapResp.status}</div>
              <pre className="p-2 bg-gray-100 rounded max-h-64 overflow-auto whitespace-pre-wrap">
{lastCapResp.text}
              </pre>
            </div>
          )}
        </div>
      )}

      {tab === 'Mappings' && (
        <div className="rounded border p-4">Mappings panel goes here…</div>
      )}

      {tab === 'Rules' && (
        <>
          <RulesIDE />
          {/* Optional: tuck CAP tester here or on a separate tab */}
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">CAP Service Tester</summary>
            <div className="mt-2">
              <CapServiceTester />
            </div>
          </details>
        </>
      )}

      {tab === 'Results' && (
        <div className="rounded border p-4">Results queue goes here…</div>
      )}
      {tab === 'Routing' && (
        <div className="rounded border p-4">Routing config goes here…</div>
      )}
      {tab === 'Logs' && (
        <div className="rounded border p-4">Logs viewer goes here…</div>
      )}
    </div>
  );
}

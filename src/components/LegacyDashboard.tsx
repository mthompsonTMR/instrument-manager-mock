'use client';
import RulesIDE from '@/components/RulesIDE';
import AssistantDrawer from '@/components/AssistantDrawer';
import CapServiceTester from "@/components/CapServiceTester";

import { useMemo, useState } from 'react';

export default function Page() {
  return (
    <>
      {/* your existing Instrument Manager UI */}
      <InstrumentManagerMock />

      {/*CAP Service Tester panel */}
      <CapServiceTester />

      {/* AI Assistant floating button + drawer */}
      <AssistantDrawer />
    </>
  );
}

type TabKey =
  | 'dashboard'
  | 'connections'
  | 'mapping'
  | 'rules'
  | 'queue'
  | 'routing'
  | 'logs'
  | 'rules-ide';

function InstrumentManagerMock() {
  return <App />;
}

function App() {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [search, setSearch] = useState('');

  const instruments = useMemo(
    () => [
      { id: 'i1', name: 'Sysmex XN-1000', driver: 'ASTM TCP', status: 'Connected', samplesToday: 318, lastSeen: '08:32' },
      { id: 'i2', name: 'Roche cobas c502', driver: 'HL7 v2 LLP', status: 'Connected', samplesToday: 264, lastSeen: '08:29' },
      { id: 'i3', name: 'Siemens Dimension EXL 200', driver: 'ASTM Serial', status: 'Degraded', samplesToday: 89, lastSeen: '08:12' },
      { id: 'i4', name: 'Abbott i-STAT Alinity', driver: 'POCT1-A', status: 'Disconnected', samplesToday: 0, lastSeen: '07:01' },
    ],
    []
  );

  const routes = [
    { id: 'r1', name: 'Epic Bridges (Results In)', protocol: 'HL7 v2 LLP', endpoint: 'llp://epic-bridges:2575', enabled: true },
    { id: 'r2', name: 'MedData FHIR Gateway', protocol: 'FHIR REST', endpoint: 'https://api.meddata.local/fhir', enabled: true },
    { id: 'r3', name: 'QC File Drop', protocol: 'SFTP', endpoint: 'sftp://qc-drop/results/', enabled: false },
  ];

  const testMaps = [
    { instCode: 'GLU', lisCode: 'GLU', name: 'Glucose', units: 'mg/dL' },
    { instCode: 'K', lisCode: 'K', name: 'Potassium', units: 'mmol/L' },
    { instCode: 'NA', lisCode: 'NA', name: 'Sodium', units: 'mmol/L' },
    { instCode: 'TNIH', lisCode: 'TROPHS', name: 'Troponin High-Sens', units: 'ng/L' },
  ];

  const rules = [
    { id: 'rule1', name: 'Delta Check – Potassium', when: "test = 'K' AND |current - previous| > 1.0", then: "Hold for manual review; add flag 'DELTA'" },
    { id: 'rule2', name: 'Critical Low Potassium', when: "test = 'K' AND value < 2.8", then: "Flag CRITICAL; route to STAT; send pager/email" },
    { id: 'rule3', name: 'Autoverify Chemistry Panel', when: "profile = 'BMP' AND allFlags = NONE AND QC = PASS", then: "Auto-release to LIS" },
  ];

  const queue = [
    { id: 'Q-102938', mrn: '00123456', specimen: 'SERUM', test: 'K', value: 3.2, units: 'mmol/L', status: 'Held — DELTA', instrument: 'c502', collected: '07:58' },
    { id: 'Q-102939', mrn: '00987654', specimen: 'PLASMA', test: 'GLU', value: 92, units: 'mg/dL', status: 'Auto-Verified', instrument: 'c502', collected: '08:11' },
    { id: 'Q-102940', mrn: '00445566', specimen: 'WHOLE BLOOD', test: 'TROPHS', value: 78, units: 'ng/L', status: 'Critical', instrument: 'EXL 200', collected: '08:14' },
  ];

  const filtered = instruments.filter((i) =>
    `${i.name} ${i.driver} ${i.status}`.toLowerCase().includes(search.toLowerCase())
  );

  // Define tabs with the correct key type so setTab is type-safe
  const tabs: [TabKey, string][] = [
    ['dashboard', 'Dashboard'],
    ['connections', 'Connections'],
    ['mapping', 'Test Mapping'],
    ['rules', 'Rules & Autoverify'],
    ['queue', 'Results Queue'],
    ['routing', 'Routing'],
    ['logs', 'Logs'],
    ['rules-ide', 'Rules IDE'],
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white grid place-items-center font-bold">IM</div>
            <div>
              <h1 className="text-xl font-semibold">Instrument Manager — Concept Mock</h1>
              <p className="text-xs text-slate-500">Drivers → Mapping → Rules → Autoverify → Routing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="#" className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800">
              Launch MedData Portal
            </a>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                className={`px-3 py-2 rounded-xl ${tab === key ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === 'dashboard' && (
          <section className="grid md:grid-cols-3 gap-4">
            <StatCard title="Connected" value={instruments.filter((i) => i.status === 'Connected').length} sub="of 4" />
            <StatCard title="Samples Today" value={instruments.reduce((a, b) => a + b.samplesToday, 0)} sub="across instruments" />
            <StatCard title="Alerts" value={1} sub="critical / degraded" />

            <div className="md:col-span-2 bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Instruments</h2>
                <input
                  placeholder="Search instruments, drivers, status…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-2 rounded-xl border w-64"
                />
              </div>
              <Table
                columns={['Instrument', 'Driver', 'Status', 'Samples', 'Last Seen', 'Actions']}
                rows={filtered.map((i) => [
                  i.name,
                  i.driver,
                  <StatusBadge key={i.id} status={i.status} />,
                  i.samplesToday,
                  i.lastSeen,
                  <div key={i.id} className="flex gap-2">
                    <button className="px-2 py-1 text-xs rounded-lg border">View</button>
                    <button className="px-2 py-1 text-xs rounded-lg border">Ping</button>
                  </div>,
                ])}
              />
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-2">Today’s Flow</h2>
              <ol className="text-sm space-y-2">
                <li>
                  1. <b>Drivers</b> receive results from analyzers
                </li>
                <li>
                  2. <b>Mappings</b> translate instrument → LIS codes
                </li>
                <li>
                  3. <b>Rules</b> apply flags, deltas, criticals
                </li>
                <li>
                  4. <b>Autoverify</b> releases clean results
                </li>
                <li>
                  5. <b>Routing</b> sends to LIS/EMR, FHIR, or SFTP
                </li>
              </ol>
              <p className="text-xs text-slate-500 mt-3">Conceptual demo for discussion; not affiliated with any vendor.</p>
            </div>
          </section>
        )}

        {tab === 'connections' && (
          <section className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-3">Instrument Connections</h2>
              <Table
                columns={['Name', 'Driver', 'Status', 'Actions']}
                rows={instruments.map((i) => [
                  i.name,
                  i.driver,
                  <StatusBadge key={i.id} status={i.status} />,
                  <div key={i.id} className="flex gap-2">
                    <button className="px-2 py-1 text-xs rounded-lg border">Config</button>
                    <button className="px-2 py-1 text-xs rounded-lg border">Restart</button>
                  </div>,
                ])}
              />
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-2">Driver Template</h3>
              <form className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Protocol" value="HL7 v2 LLP" />
                  <Field label="Host" value="10.10.12.45" />
                  <Field label="Port" value="6000" />
                  <Field label="Framing" value="MLLP <VT>...<FS><CR>" />
                  <Field label="Encoding" value="UTF-8" />
                  <Field label="ACK Mode" value="Application (AA/AE/AR)" />
                </div>
                <textarea
                  className="w-full border rounded-xl p-2"
                  rows={5}
                  defaultValue={`# Sample LLP listener config
listen: 0.0.0.0:6000
retry: 5s
timeout: 30s
keepalive: true`}
                />
                <div className="flex gap-2">
                  <button className="px-3 py-2 rounded-xl border" type="button">
                    Test Connection
                  </button>
                  <button className="px-3 py-2 rounded-xl bg-slate-900 text-white" type="button">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {tab === 'mapping' && (
          <section className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-3">Test Code Mapping</h2>
              <Table
                columns={['Instrument Code', 'LIS Code', 'Name', 'Units', 'Status']}
                rows={testMaps.map((m) => [
                  m.instCode,
                  m.lisCode,
                  m.name,
                  m.units,
                  <span
                    key={m.instCode}
                    className="px-2 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    Mapped
                  </span>,
                ])}
              />
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-2">Mapping JSON (example)</h3>
              <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto">{`{
  "instrument": "c502",
  "maps": [
    { "inst": "GLU", "lis": "GLU", "units": "mg/dL" },
    { "inst": "K",   "lis": "K",   "units": "mmol/L" },
    { "inst": "NA",  "lis": "NA",  "units": "mmol/L" }
  ]
}`}</pre>
              <p className="text-xs text-slate-500 mt-2">Translate instrument codes to LIS codes and enforce units.</p>
            </div>
          </section>
        )}

        {tab === 'rules' && (
          <section className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
              {!!RulesIDE && (   // ⬅️ this guard goes *here*
                <button
                  type="button"
                  onClick={() => setTab('rules-ide')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800"
                  title="Open the interactive rule builder (demo)"
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Open Rules IDE
                </button>
              )}
            </div>
              
              <Table columns={['Rule', 'When', 'Then']} rows={rules.map((r) => [r.name, r.when, r.then])} />
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Pseudo-rule Script</h3>
                <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto">{`when test == 'K' and value < 2.8:
  flag('CRITICAL')
  route('STAT')
  notify('on-call')
  hold()

when profile == 'BMP' and no_flags() and qc_pass():
  autoverify()`}</pre>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-2">QC Snapshot</h3>
              <ul className="text-sm space-y-2">
                <li>• Chemistry (AM): PASS</li>
                <li>• Hematology (AM): PASS</li>
                <li>
                  • Troponin (AM): <span className="text-amber-600 font-medium">WARN</span> — CV at limit
                </li>
              </ul>
              <p className="text-xs text-slate-500 mt-2">Autoverification typically requires clean QC and no rule/flag violations.</p>
            </div>
          </section>
        )}

        {tab === 'rules-ide' && (
          <section className="mt-2">
            <RulesIDE />
          </section>
        )}

        {tab === 'queue' && (
          <section className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Results Queue</h2>
            <Table
              columns={['Accession', 'MRN', 'Specimen', 'Test', 'Result', 'Status', 'Actions']}
              rows={queue.map((q) => [
                q.id,
                q.mrn,
                q.specimen,
                q.test,
                `${q.value} ${q.units}`,
                <StatusBadge key={q.id} status={q.status} />,
                <div key={q.id} className="flex gap-2">
                  <button className="px-2 py-1 text-xs rounded-lg border">Release</button>
                  <button className="px-2 py-1 text-xs rounded-lg border">Hold</button>
                  <button className="px-2 py-1 text-xs rounded-lg border">Reroute</button>
                </div>,
              ])}
            />
            <p className="text-xs text-slate-500 mt-3">Manually release, hold, or reroute when rules prevent autoverification.</p>
          </section>
        )}

        {tab === 'routing' && (
          <section className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-3">Destinations</h2>
              <Table
                columns={['Name', 'Protocol', 'Endpoint', 'Enabled']}
                rows={routes.map((r) => [
                  r.name,
                  r.protocol,
                  <span key={r.id} className="font-mono text-xs">
                    {r.endpoint}
                  </span>,
                  <span
                    key={r.id}
                    className={`px-2 py-1 text-xs rounded-lg ${
                      r.enabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border'
                    }`}
                  >
                    {r.enabled ? 'On' : 'Off'}
                  </span>,
                ])}
              />
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-2">HL7 v2 ORU^R01 — Example</h3>
              <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto">{`MSH|^~\\&|IM|LAB|EPIC|HOSP|20250827||ORU^R01|123456|P|2.5.1\r
PID|||00123456||DOE^JANE||19700101|F\r
OBR|1||A102938|BMP^Basic Metabolic Panel\r
OBX|1|NM|K^Potassium||3.2|mmol/L|3.5-5.1|L|F\r`}</pre>
              <p className="text-xs text-slate-500 mt-2">Destinations can be HL7 LLP, REST (FHIR), SFTP, or DB write.</p>
            </div>
          </section>
        )}

        {tab === 'logs' && (
          <section className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-3">Recent Events</h2>
              <Table
                columns={['Time', 'Source', 'Event', 'Detail']}
                rows={[
                  ['08:32:10', 'XN-1000', 'Ping OK', 'RTT 12ms'],
                  ['08:29:51', 'c502', 'Result Received', 'BMP panel (5 OBX)'],
                  ['08:14:04', 'EXL 200', 'Critical Flag', 'TROPHS = 78 ng/L'],
                  ['07:59:21', 'Alinity i-STAT', 'Disconnected', 'No heartbeat; retrying'],
                ]}
              />
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-2">At-a-Glance</h3>
              <ul className="text-sm space-y-2">
                <li>• 2 drivers healthy</li>
                <li>• 1 driver degraded</li>
                <li>• 1 driver offline</li>
                <li>• 1 critical result pending review</li>
              </ul>
            </div>
          </section>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 text-xs text-slate-500">
        <p>
          Disclaimer: This Instrument Manager mock interface is an independent, vendor-neutral demonstration created for
          educational and portfolio purposes. It is not affiliated with, endorsed by, or derived from any proprietary
          product or company (including Data Innovations or other LIS/middleware vendors). All data shown is synthetic
          and does not include any protected health information (PHI).
        </p>
      </footer>
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="text-slate-500 text-xs">{title}</div>
      <div className="text-3xl font-semibold">{value}</div>
      {sub && <div className="text-slate-400 text-xs">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s.startsWith('conn')
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : s.startsWith('deg')
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : s.includes('critical')
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : s.includes('held')
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : s.includes('disc')
      ? 'bg-slate-200 text-slate-700 border-slate-300'
      : 'bg-slate-100 text-slate-700 border';
  return <span className={`px-2 py-1 text-xs rounded-lg border ${cls}`}>{status}</span>;
}

function Table({ columns, rows }: { columns: string[]; rows: any[][] }) {
  return (
    <div className="overflow-auto border rounded-2xl">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>{columns.map((c) => <th key={c} className="text-left px-3 py-2 font-medium border-b">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-slate-50">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-2 border-b align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <label className="text-sm grid gap-1">
      <span className="text-slate-600">{label}</span>
      <input defaultValue={value} className="px-3 py-2 rounded-xl border" />
    </label>
  );
}

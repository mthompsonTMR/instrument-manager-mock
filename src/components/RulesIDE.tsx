'use client';
import React, { useMemo, useState } from 'react';

/** =================== Types =================== */
type Logic = 'all' | 'any';
type VersionStr = '8.7–8.11' | '8.12+';

export type RuleCondition = {
  id: string;
  field: string;
  op: 'matches' | 'contains' | 'equals' | 'exists';
  value: string;
};

export type RuleAction =
  | { type: 'addDestination'; connection: string }
  | { type: 'setDestinationDeprecated'; connection: string }
  | { type: 'flag'; code: string }
  | { type: 'hold' }
  | { type: 'notify'; target: string }
  | { type: 'route'; lane: string };

/** =================== Component =================== */
export default function RulesIDE() {
  /** -------- Version / Scope (authenticity only) -------- */
  const [version, setVersion] = useState<VersionStr>('8.12+');
  const [scope, setScope] = useState<'Incoming Result' | 'Outgoing Result' | 'QC Message'>('Incoming Result');
  const [placement, setPlacement] = useState<'Before Message Queued Internally' | 'After Result Parsed'>(
    'Before Message Queued Internally'
  );

  /** -------- Properties -------- */
  const [name, setName] = useState('CAP PT Specimen Identification');
  const [description, setDescription] = useState(
    'Identify PT Kit# and Specimen# from patient name components and route to CAP connection.'
  );
  const [enabled, setEnabled] = useState(true);
  const [logic, setLogic] = useState<Logic>('all');

  /** -------- Field options -------- */
  const fields = useMemo(
    () => [
      'PID-5.1 (Patient Name – Given / Kit #)',
      'PID-5.2 (Patient Name – Family / Specimen #)',
      'OBR-3 (Filler Order Number)',
      'OBX-3 (Observation Identifier)',
      'OBX-5 (Observation Value)',
      'SPM-2 (Specimen ID)',
    ],
    []
  );

  /** -------- Conditions / Actions -------- */
  const [conditions, setConditions] = useState<RuleCondition[]>([
    {
      id: 'c1',
      field: 'PID-5.1 (Patient Name – Given / Kit #)',
      op: 'matches',
      value: 'PT\\s*KIT\\s*#\\s*[0-9\\-]+', // e.g., "PT KIT # 19-301"
    },
    {
      id: 'c2',
      field: 'PID-5.2 (Patient Name – Family / Specimen #)',
      op: 'matches',
      value: '8N', // token -> ^\d{8}$
    },
  ]);

  const [actions, setActions] = useState<RuleAction[]>([
    { type: 'addDestination', connection: 'CAP Connection' },
  ]);

  /** -------- Drag state for JSON drop -------- */
  const [isDragging, setIsDragging] = useState(false);

  /** -------- Keep 1st action aligned to Version (single effect) -------- */
  React.useEffect(() => {
    setActions(prev => {
      const rest = prev.filter(a => a.type !== 'addDestination' && a.type !== 'setDestinationDeprecated');
      return [
        version === '8.12+' ? { type: 'addDestination', connection: 'CAP Connection' } : { type: 'setDestinationDeprecated', connection: 'CAP Connection' },
        ...rest,
      ];
    });
  }, [version]);

  /** -------- Pattern helpers -------- */
  function tokenToRegex(token: string): string {
    const t = token.trim();
    if (t === '8N') return '^\\d{8}$';
    if (/^\\d+N$/.test(t)) {
      const n = parseInt(t.replace('N', ''), 10);
      return `^\\d{${n}}$`;
    }
    if (t === '1.5E1') return '^[0-9]{1,5}[A-Z0-9]{1}$';
    if (t === '2.3E') return '^[0-9]{2,3}[A-Z0-9]$';
    return t; // treat as literal/regex provided
  }

  /** -------- Row helpers -------- */
  function addCondition() {
    setConditions(prev => [
      ...prev,
      { id: `c${prev.length + 1}`, field: fields[0], op: 'exists', value: '' },
    ]);
  }
  function updateCondition(id: string, patch: Partial<RuleCondition>) {
    setConditions(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCondition(id: string) {
    setConditions(prev => prev.filter(c => c.id !== id));
  }

  function addAction() {
    setActions(prev => [...prev, { type: 'flag', code: 'PT' }]);
  }
  function updateAction(index: number, patch: Partial<RuleAction & any>) {
    setActions(prev => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
  function removeAction(index: number) {
    setActions(prev => prev.filter((_, i) => i !== index));
  }
// last row helper:
function resetToCAPTemplate() {
  const ok = confirm('Replace current rule with the CAP PT template?');
  if (!ok) return;

  setName('CAP PT Specimen Identification');
  setDescription('Identify PT Kit# and Specimen# and route to CAP connection.');
  setEnabled(true);
  setLogic('all');

  setConditions([
    {
      id: 'c1',
      field: 'PID-5.1 (Patient Name – Given / Kit #)',
      op: 'matches',
      value: 'PT\\s*KIT\\s*#\\s*[0-9\\-]+',
    },
    {
      id: 'c2',
      field: 'PID-5.2 (Patient Name – Family / Specimen #)',
      op: 'matches',
      value: '8N',
    },
  ]);

  setActions(
    version === '8.12+'
      ? [{ type: 'addDestination', connection: 'CAP Connection' }]
      : [{ type: 'setDestinationDeprecated', connection: 'CAP Connection' }]
  );
}



  /** -------- Test Rule (synthetic message) -------- */
  const sampleMessage = useMemo(
    () => ({
      'PID-5.1 (Patient Name – Given / Kit #)': 'PT KIT # 19-301',
      'PID-5.2 (Patient Name – Family / Specimen #)': '12345678',
      'OBR-3 (Filler Order Number)': 'A102938',
      'OBX-3 (Observation Identifier)': 'K^Potassium',
      'OBX-5 (Observation Value)': '3.2',
      'SPM-2 (Specimen ID)': 'SPC-55',
    }),
    []
  );

  function evalCondition(cond: RuleCondition, msg: Record<string, string>): boolean {
    const fieldVal = msg[cond.field] ?? '';
    switch (cond.op) {
      case 'exists':
        return fieldVal.length > 0;
      case 'equals':
        return fieldVal === cond.value;
      case 'contains':
        return fieldVal.toLowerCase().includes(cond.value.toLowerCase());
      case 'matches': {
        const pattern = tokenToRegex(cond.value);
        try {
          const re = new RegExp(pattern);
          return re.test(fieldVal);
        } catch {
          return fieldVal.includes(cond.value);
        }
      }
    }
  }

  function testRule() {
    const results = conditions.map(c => ({ id: c.id, ok: evalCondition(c, sampleMessage) }));
    const pass = logic === 'all' ? results.every(r => r.ok) : results.some(r => r.ok);
    alert(
      `Test against synthetic message:\n` +
      results.map(r => `• Condition ${r.id}: ${r.ok ? 'PASS' : 'FAIL'}`).join('\n') +
      `\n\nOverall: ${pass ? 'RULE WOULD TRIGGER' : 'NO TRIGGER'}`
    );
  }

  /** -------- Save (typed target) -------- */
  function saveRule(target: 'Test/In-Validation' | 'Live') {
    if (target === 'Live') {
      const ok = confirm('You are about to SAVE TO LIVE.\n\nIMPORTANT: Training/demo UI only. Ensure no patient samples can transmit.');
      if (!ok) return;
    }
    alert(`Saved "${name}" to ${target}. (Demo-only)`);
  }

  /** -------- New / Copy / Delete (single-rule mode) -------- */
  function newRulePreset() {
    setName('New Rule');
    setDescription('');
    setEnabled(true);
    setLogic('all');
    setConditions([{ id: 'c1', field: fields[0], op: 'exists', value: '' }]);
    setActions(version === '8.12+' ? [{ type: 'addDestination', connection: 'CAP Connection' }] : [{ type: 'setDestinationDeprecated', connection: 'CAP Connection' }]);
  }
 function copyRulePreset() {
  // Duplicate the rule state
  setName(prev => (prev ? `${prev} (Copy)` : 'Copied Rule'));
  setDescription(description);
  setEnabled(enabled);
  setLogic(logic);
  setConditions([...conditions]);
  setActions([...actions]);

  // Optional feedback
  alert('Rule duplicated into a new copy.');
}

  function deleteRulePreset() {
    if (!confirm('Delete the current rule and reset to a blank template?')) return;
    setName('Untitled Rule');
    setDescription('');
    setEnabled(false);
    setLogic('all');
    setConditions([]);
    setActions(version === '8.12+' ? [{ type: 'addDestination', connection: 'CAP Connection' }] : [{ type: 'setDestinationDeprecated', connection: 'CAP Connection' }]);
  }
    
  /** -------- Export / Import / Persistence -------- */
  const exportJSON = useMemo(
    () =>
      JSON.stringify(
        { version, scope, placement, name, description, enabled, logic, conditions, actions },
        null,
        2
      ),
    [version, scope, placement, name, description, enabled, logic, conditions, actions]
  );

  function handleImport(jsonText: string) {
    try {
      const data = JSON.parse(jsonText);
      setVersion((data.version as VersionStr) ?? '8.12+');
      setScope(data.scope ?? 'Incoming Result');
      setPlacement(data.placement ?? 'Before Message Queued Internally');
      setName(data.name ?? name);
      setDescription(data.description ?? description);
      setEnabled(Boolean(data.enabled));
      setLogic(data.logic === 'any' ? 'any' : 'all');
      setConditions(Array.isArray(data.conditions) ? data.conditions : []);
      setActions(Array.isArray(data.actions) ? data.actions : []);
      alert('Imported rule JSON.');
    } catch (e: any) {
      alert('Import failed: ' + e.message);
    }
  }

  // download current json
  function downloadJSON(filename = `${name.replace(/\s+/g, '_')}.json`) {
    const blob = new Blob([exportJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // import from file
  async function importFromFile(file: File) {
    const text = await file.text();
    handleImport(text);
  }

  // localStorage persist/restore
  React.useEffect(() => {
    try {
      localStorage.setItem('ruleside.currentRule', exportJSON);
    } catch {}
  }, [exportJSON]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('ruleside.currentRule');
      if (saved) handleImport(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drag & drop handlers for JSON
  function onDragOverJSON(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragLeaveJSON() {
    setIsDragging(false);
  }
  async function onDropJSON(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!/\.json$/i.test(file.name)) {
      alert('Please drop a .json file.');
      return;
    }
    const text = await file.text();
    handleImport(text);
  }

  // Common flag codes you can expand anytime
    const FLAG_OPTIONS = [
      'CRITICAL',
      'DELTA',
      'REVIEW',
      'QCFAIL',
      'HEMOLYZED',
      'RECOLLECT',
      'PANIC',
    ] as const;

// (optional) normalize to uppercase to avoid typos
function normalizeFlagCode(v: string) {
  return (v || '').trim().toUpperCase();
}

  /** =================== Render =================== */
  return (
    <div className="grid lg:grid-cols-[280px,1fr,320px] gap-4">
      {/* Left: Rule Tree */}
      <section className="bg-white rounded-2xl shadow p-4 h-fit text-sm leading-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Rule Tree</h2>
          <span className="text-xs text-slate-500">{version}</span>
        </div>

        <label className="text-xs text-slate-600">Scope</label>
        <select className="w-full border rounded-xl px-2 py-1 mb-2" value={scope} onChange={e => setScope(e.target.value as any)}>
          <option>Incoming Result</option>
          <option>Outgoing Result</option>
          <option>QC Message</option>
        </select>

        <label className="text-xs text-slate-600">Placement</label>
        <select className="w-full border rounded-xl px-2 py-1 mb-3" value={placement} onChange={e => setPlacement(e.target.value as any)}>
          <option>Before Message Queued Internally</option>
          <option>After Result Parsed</option>
        </select>

        <div className="text-sm">
          <ul className="space-y-1">
            <li>
              <b>Test/In Validation</b>
              <ul className="ml-3 list-disc pl-4 mt-1">
                <li>
                  <b>{scope}</b>
                  <ul className="ml-3 list-disc pl-4 mt-1">
                    <li>
                      <b>{placement}</b>
                      <ul className="ml-3 list-disc pl-4 mt-1">
                        <li className="text-slate-700">{name}</li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
            <li className="text-slate-400 italic">Live (no rules)</li>
          </ul>
        </div>

        <div className="mt-4 border-t pt-3">
          <label className="text-xs text-slate-600">Version</label>
          <select className="w-full border rounded-xl px-2 py-1" value={version} onChange={e => setVersion(e.target.value as VersionStr)}>
            <option>8.7–8.11</option>
            <option>8.12+</option>
          </select>
        </div>
      </section>

      {/* Center: Rule Builder */}
      <section className="bg-white rounded-2xl shadow p-4 text-sm leading-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-2">
          {/* New rule: clears the screen to a default blank rule */}
          <button className="px-3 py-1.5 rounded-xl border" onClick={newRulePreset}>
            New
          </button>
        <span className="pl-4 border-l border-slate-300">
          <button
            className="px-3 py-1.5 rounded-xl border"
            onClick={resetToCAPTemplate}
            title="Load CAP PT training template"
          >
            Reset to Template
          </button>
        </span>

       

          <button
            className="px-3 py-1.5 rounded-xl border"
            onClick={copyRulePreset}
          >
            Copy…
          </button>
          <button
            className="px-3 py-1.5 rounded-xl border"
            onClick={deleteRulePreset}
          >
            Delete
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-xl border"
            onClick={testRule}
          >
            Test Rule
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white"
            onClick={() => saveRule('Test/In-Validation')}
          >
            Save Test/In-Validation
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white disabled:opacity-40"
            disabled={!enabled}
            title={enabled ? 'Save rule to Live' : 'Enable the rule to save to Live'}
            onClick={() => saveRule('Live')}
          >
            Save Live
          </button>
        </div>

        </div>

        {/* IF */}
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-slate-600">IF</span>
            <select className="border rounded-xl px-2 py-1" value={logic} onChange={e => setLogic(e.target.value as Logic)}>
              <option value="all">ALL (AND)</option>
              <option value="any">ANY (OR)</option>
            </select>
            <span className="text-slate-600">of the following match:</span>
          </div>

          <div className="space-y-2">
            {conditions.map(c => (
              <div key={c.id} className="grid md:grid-cols-[1fr,140px,1fr,auto] gap-2 items-center border rounded-xl p-2">
                <select className="border rounded-xl px-2 py-1" value={c.field} onChange={e => updateCondition(c.id, { field: e.target.value })}>
                  {fields.map(f => <option key={f}>{f}</option>)}
                </select>

                <select className="border rounded-xl px-2 py-1" value={c.op} onChange={e => updateCondition(c.id, { op: e.target.value as RuleCondition['op'] })}>
                  <option value="matches">matches pattern</option>
                  <option value="contains">contains</option>
                  <option value="equals">equals</option>
                  <option value="exists">exists</option>
                </select>

                <div className="flex gap-2 items-center">
                  <input
                    placeholder="regex or token (e.g., 8N)"
                    className="border rounded-xl px-2 py-1 w-full"
                    value={c.value}
                    onChange={e => updateCondition(c.id, { value: e.target.value })}
                  />
                  <PatternMenu onPick={token => updateCondition(c.id, { value: token })} />
                </div>

                <button className="px-2 py-1 text-xs rounded-lg border" onClick={() => removeCondition(c.id)}>Remove</button>

                {c.op === 'matches' && !c.value?.trim() && (
                  <div className="col-span-full text-xs text-amber-700 ml-2">Enter a regex or token (e.g., 8N)</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2">
            <button className="px-3 py-2 rounded-xl border" onClick={addCondition}>+ Add Condition</button>
          </div>
        </div>

        {/* THEN */}
        <div className="mt-6">
          <div className="text-sm text-slate-600 mb-2">THEN do:</div>

          <div className="space-y-2">
            {actions.map((a, i) => (
              <div key={i} className="grid md:grid-cols-[220px,1fr,auto] gap-2 items-center border rounded-xl p-2">
                <select
                  className="border rounded-xl px-2 py-1"
                  value={a.type}
                  onChange={e => {
                    const v = e.target.value as RuleAction['type'];
                    if (v === 'addDestination') updateAction(i, { type: 'addDestination', connection: (a as any).connection ?? 'CAP Connection' });
                    else if (v === 'setDestinationDeprecated') updateAction(i, { type: 'setDestinationDeprecated', connection: (a as any).connection ?? 'CAP Connection' });
                    else if (v === 'flag') updateAction(i, { type: 'flag', code: 'PT' });
                    else if (v === 'hold') updateAction(i, { type: 'hold' });
                    else if (v === 'notify') updateAction(i, { type: 'notify', target: 'on-call' });
                    else if (v === 'route') updateAction(i, { type: 'route', lane: 'STAT' });
                  }}
                >
                  <option value="addDestination">Add Destination Connection(s)</option>
                  <option value="setDestinationDeprecated">Set Destination Connection (8.7–8.11)</option>
                  <option value="flag">Flag</option>
                  <option value="hold">Hold</option>
                  <option value="notify">Notify</option>
                  <option value="route">Route</option>
                </select>

                <div>
                {a.type === 'addDestination' || a.type === 'setDestinationDeprecated' ? (
                  <input
                    className="border rounded-xl px-2 py-1 w-full"
                    value={(a as any).connection ?? ''}
                    onChange={(e) => updateAction(i, { connection: e.target.value })}
                    placeholder="Connection name"
                  />
                ) : a.type === 'flag' ? (
                  <div className="flex gap-2 w-full">
                    {/* Dropdown of common flags */}
                    <select
                      className="border rounded-xl px-2 py-1"
                      value={(a as any).code ?? ''}
                      onChange={(e) => updateAction(i, { code: normalizeFlagCode(e.target.value) })}
                    >
                      <option value="">-- select flag --</option>
                      {FLAG_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {/* Free-text override (custom flag) */}
                    <input
                      className="border rounded-xl px-2 py-1 flex-1"
                      placeholder="or type a custom flag (e.g., HEMOLYZED)"
                      value={(a as any).code ?? ''}
                      onChange={(e) => updateAction(i, { code: normalizeFlagCode(e.target.value) })}
                    />
                  </div>
                ) : a.type === 'notify' ? (
                  <input
                    className="border rounded-xl px-2 py-1 w-full"
                    value={(a as any).target ?? ''}
                    onChange={(e) => updateAction(i, { target: e.target.value })}
                    placeholder="Notify target (e.g., on-call)"
                  />
                ) : a.type === 'route' ? (
                  <input
                    className="border rounded-xl px-2 py-1 w-full"
                    value={(a as any).lane ?? ''}
                    onChange={(e) => updateAction(i, { lane: e.target.value })}
                    placeholder="Lane (e.g., STAT)"
                  />
                ) : null}
              </div>


                <button className="px-2 py-1 text-xs rounded-lg border" onClick={() => removeAction(i)}>Remove</button>
              </div>
            ))}
          </div>

          <div className="mt-2">
            <button className="px-3 py-2 rounded-xl border" onClick={addAction}>+ Add Action</button>
          </div>
        </div>

        {/* Preview + Export */}
        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-1">Pseudo-rule Script</h3>
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto">{[
              `WHEN ${logic.toUpperCase()} OF:`,
              ...conditions.map(c => `  ${c.field} ${c.op.toUpperCase()} ${c.value}`),
              `THEN:`,
              ...actions.map(a => {
                switch (a.type) {
                  case 'addDestination': return `  ADD DESTINATION CONNECTION(S) "${(a as any).connection}"`;
                  case 'setDestinationDeprecated': return `  SET DESTINATION CONNECTION "${(a as any).connection}"`;
                  case 'flag': return `  FLAG "${(a as any).code}"`;
                  case 'hold': return `  HOLD`;
                  case 'notify': return `  NOTIFY "${(a as any).target}"`;
                  case 'route': return `  ROUTE "${(a as any).lane}"`;
                }
              }),
            ].join('\n')}</pre>
          </div>

          {/* Export JSON panel with toolbar + drag/drop */}
          <div
            onDragOver={onDragOverJSON}
            onDragLeave={onDragLeaveJSON}
            onDrop={onDropJSON}
            className={isDragging ? 'ring-2 ring-emerald-500 rounded-xl' : undefined}
          >
            <h3 className="font-semibold mb-1">Export JSON</h3>

            <div className="flex items-center gap-2 mb-2">
              <button type="button" className="px-2 py-1 text-xs rounded-lg border" onClick={() => downloadJSON()} title="Download current rule as JSON">
                Download JSON
              </button>

              <label className="px-2 py-1 text-xs rounded-lg border cursor-pointer">
                Import from file…
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) importFromFile(f);
                    e.currentTarget.value = ''; // allow re-select
                  }}
                />
              </label>
            </div>

            {isDragging && (
              <div className="mb-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                Drop a .json file to import…
              </div>
            )}

            <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto">{exportJSON}</pre>

            <details className="mt-2 text-xs text-slate-500">
              <summary>Import JSON…</summary>
              <textarea
                className="w-full border rounded-xl p-2 mt-2"
                rows={6}
                placeholder="Paste rule JSON here"
                onBlur={(e) => e.currentTarget.value && handleImport(e.currentTarget.value)}
              />
              <p className="mt-1">(Paste JSON and click outside the box to import.)</p>
            </details>
          </div>
        </div>
      </section>

      {/* Right: Properties */}
      <section className="bg-white rounded-2xl shadow p-4 h-fit text-sm leading-5">
        <h2 className="font-semibold mb-3">Properties</h2>

        <label className="text-xs text-slate-600">Name</label>
        <input className="w-full border rounded-xl px-2 py-1.5 text-sm mb-2" value={name} onChange={e => setName(e.target.value)} />

        <label className="text-xs text-slate-600">Description</label>
        <textarea className="w-full border rounded-xl px-2 py-1.5 text-sm mb-2" rows={3} value={description} onChange={e => setDescription(e.target.value)} />

        <div className="flex items-center gap-2 mb-3">
          <input id="enabled" type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          <label htmlFor="enabled" className="text-sm">Enabled</label>
        </div>

        <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-3 mb-3">
          <b>Safety Notice:</b> Training/demo UI. Ensure no patient samples or PHI can transmit. Use Test/In-Validation until validated.
        </div>

        <div className="text-xs text-slate-500">
          <p>
            <b>Pattern Tokens:</b> <code>8N</code> → <code>^\\d{8}$</code>; <code>1.5E1</code> ≈ <code>[0-9]&#123;1,5&#125;[A-Z0-9]&#123;1&#125;</code>;
            <code> 2.3E</code> ≈ <code>[0-9]&#123;2,3&#125;[A-Z0-9]</code>. Full regex also supported.
          </p>
        </div>
      </section>
    </div>
  );
}

/** =================== Pattern Menu =================== */
function PatternMenu({ onPick }: { onPick: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  const items = ['8N', '6N', '1.5E1', '2.3E', 'PT\\s*KIT\\s*#\\s*[0-9\\-]+'];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className="px-2 py-1 text-xs rounded-lg border">
        Patterns
      </button>
      {open && (
        <div className="absolute z-10 mt-1 bg-white border rounded-xl shadow text-xs min-w-[200px]">
          {items.map(p => (
            <button
              key={p}
              className="block w-full text-left px-3 py-2 hover:bg-slate-50"
              onClick={() => {
                onPick(p);
                setOpen(false);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


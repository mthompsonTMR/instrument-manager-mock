'use client';
import { useState } from 'react';

type Msg = { role: 'user' | 'assistant'; text: string };

export default function AssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'assistant',
      text:
        "Hi! I can explain statuses, propose mappings/rules, and draft HL7/FHIR examples. (We’ll wire the backend in the next step.)",
    },
  ]);

  function send() {
    if (!input.trim()) return;
    const userMsg: Msg = { role: 'user', text: input.trim() };
    const stubReply: Msg = {
      role: 'assistant',
      text:
        "Got it. I’ll answer for real once we connect the API in the next step.",
    };
    setMsgs((m) => [...m, userMsg, stubReply]);
    setInput('');
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 px-4 py-3 rounded-2xl shadow bg-slate-900 text-white"
      >
        Ask AI
      </button>

      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onClick={() => setOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl p-4 grid grid-rows-[auto,1fr,auto] gap-3"
          >
            <header className="flex items-center justify-between">
              <h3 className="font-semibold">AI Assistant (Read-only, Phase 1)</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500"
              >
                Close
              </button>
            </header>

            <div className="overflow-auto space-y-3">
              {msgs.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div
                    className={`inline-block px-3 py-2 rounded-2xl ${
                      m.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap text-sm">{m.text}</pre>
                  </div>
                  {m.role === 'assistant' && (m as any).meta && (
                    <details className="mt-1 text-xs text-slate-500">
                      <summary>Details</summary>
                      <pre className="overflow-auto">{JSON.stringify((m as    any).  meta, null, 2)}</pre>
                     </details>
                    )}
                  </div>
                ))}
              </div>

            <footer className="grid grid-cols-[1fr,auto] gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='e.g., "Explain why EXL 200 is Degraded."'
                className="px-3 py-2 rounded-xl border"
              />
              <button
                onClick={send}
                className="px-3 py-2 rounded-xl bg-slate-900 text-white"
              >
                Send
              </button>
            </footer>

            <div className="text-xs text-slate-500">
              Try: “Propose mappings for GLU, K, NA.” · “Create a delta rule for Potassium.” ·
              “Show an ORU^R01 for BMP with K=3.2 (L).”
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

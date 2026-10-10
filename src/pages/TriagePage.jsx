import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSim } from '../context/SimContext.jsx';
import { PriorityBadge, SimControls, StatusBadge, TriageExplain, waitOf } from '../components/dash.jsx';
import { useToast } from '../components/feedback.jsx';
import { Card, Code, Slider } from '../components/ui.jsx';
import { SYMPTOMS, label, solveAll } from '../lib/prolog.js';
import { CONDITIONS, DIAGS } from '../lib/patients.js';
import { DEPT_BY_CONDITION, explainReason } from '../lib/simData.js';

const CLS = { severe: 'sev', moderate: 'mod', mild: 'mld' };
const BLANK = { age: 54, sex: 'F', pain: 4, temp: 37.2, heartRate: 84, symptoms: ['cough'], condition: 'general', diag: 'none' };

function WalkIn({ onAdded }) {
  const { sim } = useSim();
  const toast = useToast();
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const toggle = (s) => setF({ ...f, symptoms: f.symptoms.includes(s) ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s] });
  const submit = async () => {
    if (!f.symptoms.length) { toast('Choose at least one symptom', 'error'); return; }
    setBusy(true);
    try {
      const p = await sim.addPatient({ ...f, sys: 120, bmi: 25, glucose: 100 });
      if (p) { toast(`${p.id} triaged: ${p.priority} (Prolog rule base)`); onAdded(p.id); setF(BLANK); }
    } finally { setBusy(false); }
  };
  return (
    <Card title="Triage a new walk-in" sub="Enter a presentation. The Prolog rules classify it and the patient joins the live queue.">
      <Slider label="Age" unit="yrs" min={1} max={95} value={f.age} onChange={(age) => setF({ ...f, age })} />
      <Slider label="Pain level" unit="/10" min={0} max={10} value={f.pain} onChange={(pain) => setF({ ...f, pain })} />
      <Slider label="Temperature" unit="°C" min={35} max={41.5} step={0.1} value={f.temp} onChange={(temp) => setF({ ...f, temp })} />
      <Slider label="Heart rate" unit="bpm" min={40} max={180} value={f.heartRate} onChange={(heartRate) => setF({ ...f, heartRate })} />
      {Object.entries(SYMPTOMS).map(([cls, list]) => (
        <div key={cls} style={{ marginBottom: 10 }}>
          <div className="lbl" style={{ marginBottom: 5, textTransform: 'capitalize' }}>{cls} symptoms</div>
          <div className="chips">{list.map((s) => <button key={s} className={`chip ${f.symptoms.includes(s) ? `on ${CLS[cls]}` : ''}`} onClick={() => toggle(s)} aria-pressed={f.symptoms.includes(s)}>{label(s)}</button>)}</div>
        </div>
      ))}
      <div className="grid g2" style={{ gap: 10 }}>
        <div className="field"><label>Condition area</label><select value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>{CONDITIONS.map((c) => <option key={c} value={c}>{DEPT_BY_CONDITION[c]}</option>)}</select></div>
        <div className="field"><label>Diagnostics needed</label><select value={f.diag} onChange={(e) => setF({ ...f, diag: e.target.value })}>{DIAGS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></div>
      </div>
      <button className="btn primary" onClick={submit} disabled={busy}>{busy ? 'Running Prolog…' : 'Triage and add to queue'}</button>
    </Card>
  );
}

export default function TriagePage() {
  const { snap, d } = useSim();
  const loc = useLocation();
  const navigate = useNavigate();
  const [sel, setSel] = useState(null);
  const [query, setQuery] = useState('priority(p1, X).');
  const [answers, setAnswers] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (loc.state?.openId) { setSel(loc.state.openId); navigate('/triage', { replace: true, state: null }); }
  }, [loc.state, navigate]);

  const list = useMemo(() => d.active.filter((p) => p.status !== 'triage').sort((a, b) => b.arrivalTick - a.arrivalTick).slice(0, 14), [d.active]);
  const p = snap.patients.find((x) => x.id === sel) ?? list[0];

  const run = async () => {
    if (!p?.prolog) return;
    try { setAnswers(await solveAll(p.prolog.program, query.trim().endsWith('.') ? query : `${query}.`, 30)); setErr(''); }
    catch (e) { setAnswers(null); setErr(e.message); }
  };

  return (
    <div>
      <div className="page-title-row"><div><h1>Patient triage</h1><p>Every arrival is classified by a Prolog rule base. Choose a patient to see the factors behind the suggested priority.</p></div></div>
      <SimControls compact />
      <div className="grid g-side">
        <div className="stack">
          <Card title="Recently triaged" sub="Newest first. Click to inspect.">
            {list.length === 0 ? <div className="empty"><b>No patients yet</b>Start the simulation or triage a walk-in.</div> : (
              <div className="stack" style={{ gap: 6 }}>
                {list.map((x) => (
                  <button key={x.id} className="menu-item" style={{ border: '1px solid var(--line)', borderRadius: 9, background: p?.id === x.id ? 'var(--teal-soft)' : '#fff' }} onClick={() => setSel(x.id)} aria-pressed={p?.id === x.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row spread nowrap"><b>{x.id}</b><PriorityBadge level={x.priority} /></div>
                      <div className="note">{x.dept} · waited {waitOf(x, snap.tick)} min · {x.prolog ? explainReason(x.prolog.reasons[0] ?? '') : 'triage…'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
          <WalkIn onAdded={setSel} />
        </div>
        <div className="stack">
          {p ? (
            <>
              <Card title={`Triage decision for ${p.id}`} right={<StatusBadge status={p.status} />}><TriageExplain p={p} /></Card>
              <Card title="Prolog console" sub="Query this patient’s knowledge base. Try: priority_reason(p1, L, R).  or  severe(S).">
                <div className="row nowrap">
                  <input className="input-sm mono" style={{ flex: 1 }} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} aria-label="Prolog query" />
                  <button className="btn primary" onClick={run} disabled={!p.prolog}>Run</button>
                </div>
                {err && <div className="alert-item emergency" style={{ marginTop: 10 }}><div className="txt">{err}</div></div>}
                {answers && <div className="code" style={{ marginTop: 10, maxHeight: 160 }}>{answers.length === 0 ? 'false.' : answers.map((a) => (Object.keys(a).length ? `${Object.entries(a).map(([k, v]) => `${k} = ${v}`).join(', ')} ;` : 'true.')).join('\n')}</div>}
              </Card>
              <Card title="Knowledge base for this patient" sub="The rules and facts consulted by the Prolog engine."><Code>{p.prolog?.program ?? ''}</Code></Card>
            </>
          ) : <div className="empty"><b>Select a patient</b>Their triage explanation appears here.</div>}
        </div>
      </div>
    </div>
  );
}

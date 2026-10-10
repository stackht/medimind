import { useEffect, useState } from 'react';
import { usePatient } from '../context/PatientContext.jsx';
import { classifyPatient, solveAll, SYMPTOMS, label } from '../lib/prolog.js';
import { Badge, Card, Code, Explain, PageHeader, Slider } from '../components/ui.jsx';

const CLS = { severe: 'sev', moderate: 'mod', mild: 'mld' };

export default function Triage() {
  const { patient, update } = usePatient();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('priority(p1, X).');
  const [answers, setAnswers] = useState(null);

  useEffect(() => {
    let live = true;
    classifyPatient(patient).then((r) => live && (setRes(r), setErr(''))).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [patient]);

  const toggle = (s) => update({ symptoms: patient.symptoms.includes(s) ? patient.symptoms.filter((x) => x !== s) : [...patient.symptoms, s] });
  const runQuery = async () => {
    try { setAnswers(await solveAll(res.program, query.trim().endsWith('.') ? query : `${query}.`, 30)); setErr(''); }
    catch (e) { setAnswers(null); setErr(e.message); }
  };

  return (
    <div className="stack">
      <PageHeader title="Priority Triage with Prolog"
        desc="Reported symptoms become Prolog facts. A rule base reasons over them to classify the case as low, medium or high priority and recommend an assessment priority, and it can explain which rules fired."
        tags={['Prolog (Tau Prolog)', 'Facts', 'Rules', 'Logical reasoning']} />

      <div className="grid g-side">
        <Card title="Patient presentation" sub="Edits here update the Prolog facts instantly and are shared with other modules.">
          <Slider label="Age" unit="yrs" min={1} max={95} value={patient.age} onChange={(age) => update({ age })} />
          <Slider label="Pain level" unit="/10" min={0} max={10} value={patient.pain} onChange={(pain) => update({ pain })} />
          <Slider label="Body temperature" unit="°C" min={35} max={41.5} step={0.1} value={patient.temp} onChange={(temp) => update({ temp })} />
          {Object.entries(SYMPTOMS).map(([cls, list]) => (
            <div key={cls} style={{ marginBottom: 12 }}>
              <div className="lbl" style={{ marginBottom: 6, textTransform: 'capitalize' }}>{cls} symptoms</div>
              <div className="chips">
                {list.map((s) => (
                  <button key={s} className={`chip ${patient.symptoms.includes(s) ? `on ${CLS[cls]}` : ''}`} onClick={() => toggle(s)} aria-pressed={patient.symptoms.includes(s)}>{label(s)}</button>
                ))}
              </div>
            </div>
          ))}
        </Card>

        <div className="stack">
          <Card title="Classification result">
            {err && <div className="explain" style={{ borderColor: 'var(--high)', background: 'var(--high-soft)' }}>{err}</div>}
            {res ? (
              <div className="stack" style={{ gap: 14 }}>
                <div className="row spread">
                  <div><div className="note">Priority category</div><Badge level={res.priority}><span style={{ fontSize: 16 }}>{res.priority} priority</span></Badge></div>
                  <div style={{ maxWidth: 360, fontWeight: 600 }}>{res.recommendation}</div>
                </div>
                <div>
                  <div className="lbl" style={{ marginBottom: 6 }}>Rules that fired for “{res.priority}”</div>
                  <table className="tbl"><tbody>
                    {res.reasons.map((r) => <tr key={r}><td className="mono">priority_reason(p1, {res.priority}, <b>{r}</b>)</td></tr>)}
                  </tbody></table>
                </div>
                <Explain>Prolog tries <span className="mono">priority(p1, high)</span> first. If any <span className="mono">priority_reason</span> rule proves it, the cut (<span className="mono">!</span>) commits to it; otherwise it falls through to medium, then low.</Explain>
              </div>
            ) : <div className="note">Reasoning…</div>}
          </Card>

          <Card title="Prolog console" sub="Ask the knowledge base anything. Try: priority_reason(p1, L, R).  or  severe(S).">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="mono" style={{ flex: 1, border: '1px solid var(--line-strong)', borderRadius: 9, padding: '7px 10px' }} value={query}
                onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && res && runQuery()} aria-label="Prolog query" />
              <button className="btn primary" onClick={runQuery} disabled={!res}>Run</button>
            </div>
            {answers && (
              <div className="code" style={{ marginTop: 10, maxHeight: 160 }}>
                {answers.length === 0 ? 'false.' : answers.map((a, i) => (Object.keys(a).length ? Object.entries(a).map(([k, v]) => `${k} = ${v}`).join(', ') + ' ;' : 'true.')).join('\n')}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title="Knowledge base (rules + this patient’s facts)" sub="This is the actual program consulted by the Prolog engine.">
        <Code>{res?.program ?? ''}</Code>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { useSim } from '../context/SimContext.jsx';
import { classifyPatient, label } from '../lib/prolog.js';
import { infer, VITALS_SYSTEM } from '../lib/fuzzy.js';
import { getTrainedModel, scoreRisk, riskCategory } from '../lib/anfis.js';
import { NODE_BY_ID } from '../lib/graph.js';
import { destinationFor } from '../lib/patients.js';
import { explainReason, toPriority } from '../lib/simData.js';
import { AGENT_TYPE, ENV_PROPERTIES, FORMULATION, PEAS, PROBLEM_STATEMENT, TARGET_MIN, performanceMeasures } from '../lib/peas.js';
import { Badge, Card, Explain, PageHeader, Stat } from '../components/ui.jsx';
import { PriorityBadge } from '../components/dash.jsx';

const LETTERS = [['P', 'Performance measure', 'performance', 'var(--teal-ink)'], ['E', 'Environment', 'environment', 'var(--info)'], ['A', 'Actuators', 'actuators', 'var(--warn)'], ['S', 'Sensors', 'sensors', 'var(--ok)']];
const f1 = (x) => (x == null ? 'n/a' : x.toFixed(1));

function AgentDemo() {
  const { patient } = usePatient();
  const [out, setOut] = useState(null);
  useEffect(() => {
    let live = true;
    classifyPatient(patient).then((t) => {
      if (!live) return;
      const vit = infer(VITALS_SYSTEM, { heartRate: patient.heartRate, temp: patient.temp });
      const risk = scoreRisk(getTrainedModel().model, patient);
      setOut({ t, vit, risk, pr: toPriority(t), dest: destinationFor(patient, t.priority) });
    });
    return () => { live = false; };
  }, [patient]);

  return (
    <div className="grid g2">
      <Card title="Percept (from the sensors)" sub="The current input patient. Change it with the selector above, or load a patient from the live simulation.">
        <table className="tbl"><tbody>
          <tr><td>Symptoms</td><td><b>{patient.symptoms.map(label).join(', ') || 'none reported'}</b></td></tr>
          <tr><td>Age / pain</td><td><b>{patient.age} yrs / {patient.pain} of 10</b></td></tr>
          <tr><td>Heart rate / temperature</td><td><b>{patient.heartRate} bpm / {patient.temp} °C</b></td></tr>
          <tr><td>Blood pressure, BMI, glucose</td><td><b>{patient.sys} mmHg, {patient.bmi}, {patient.glucose} mg/dL</b></td></tr>
        </tbody></table>
      </Card>
      <Card title="Action (from the actuators)" sub="Agent function: percept → rule base, fuzzy monitor and risk model → action.">
        {!out ? <div className="note">Reasoning…</div> : (
          <table className="tbl"><tbody>
            <tr><td>Assign priority</td><td><PriorityBadge level={out.pr} /> <span className="algo-tag">Prolog rule base</span></td></tr>
            <tr><td>Because</td><td>{out.t.reasons.map((r) => <div key={r}>{explainReason(r)}</div>)}</td></tr>
            <tr><td>Monitoring alert</td><td><Badge level={out.vit.label} /> {out.vit.crisp.toFixed(0)}/100 <span className="algo-tag">Mamdani FIS</span></td></tr>
            <tr><td>Risk estimate</td><td><Badge level={riskCategory(out.risk)} /> {out.risk}/100 <span className="algo-tag">Neuro-fuzzy</span></td></tr>
            <tr><td>Assessment target</td><td>{out.t.recommendation}</td></tr>
            <tr><td>Destination</td><td>{NODE_BY_ID[out.dest].name} {out.pr === 'emergency' ? '(route planned with A*)' : '(route by BFS)'}</td></tr>
          </tbody></table>
        )}
      </Card>
    </div>
  );
}

export default function Peas() {
  const { snap } = useSim();
  const m = useMemo(() => performanceMeasures(snap), [snap]);
  const classes = ['emergency', 'high', 'moderate', 'routine'];

  return (
    <div className="stack">
      <PageHeader title="AI-Based Patient Triage and Monitoring System" desc={PROBLEM_STATEMENT} tags={['Problem formulation', 'PEAS model', 'Intelligent agent']} />

      <Card title="1. Problem identification" sub="What the agent must solve">
        <p style={{ maxWidth: '80ch' }}>{PROBLEM_STATEMENT}</p>
        <p className="note" style={{ marginTop: 8 }}>Agent: <b>{PEAS.agent}</b>. Agent type: {AGENT_TYPE}</p>
      </Card>

      <Card title="2. PEAS description" sub="Performance measure, Environment, Actuators, Sensors">
        <div className="grid g2">
          {LETTERS.map(([ch, name, key, color]) => (
            <div key={key} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${color}` }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}><span style={{ color, fontSize: 18, marginRight: 6 }}>{ch}</span>{name}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>{PEAS[key].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g2">
        <Card title="3. Task environment properties">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Property</th><th>Classification</th><th>Why</th></tr></thead><tbody>
            {ENV_PROPERTIES.map(([a, b, c]) => <tr key={a}><td><b>{a}</b></td><td>{b}</td><td className="note">{c}</td></tr>)}
          </tbody></table></div>
        </Card>
        <Card title="4. Problem formulation" sub="State-space formulation of the triage and monitoring task">
          <div className="tbl-wrap"><table className="tbl"><tbody>
            {FORMULATION.map(([a, b]) => <tr key={a}><td style={{ whiteSpace: 'nowrap' }}><b>{a}</b></td><td>{b}</td></tr>)}
          </tbody></table></div>
        </Card>
      </div>

      <Card title="5. Agent in action" sub="The agent function applied to one percept, using the algorithms of the other experiments">
        <AgentDemo />
      </Card>

      <Card title="6. Measuring the performance measure on the live simulation"
        sub={`Computed from the shared simulation (${m.patients} patients so far). Start the simulation on the Overview page to see these change.`}
        right={<Link to="/" className="btn sm">Open overview</Link>}>
        <div className="grid g4" style={{ gap: 10, marginBottom: 12 }}>
          <Stat k="Assessed within target" v={m.withinPct == null ? 'n/a' : `${m.withinPct.toFixed(0)}%`} s="all patients" />
          <Stat k="Urgent mean wait" v={m.urgentAvg == null ? 'n/a' : `${m.urgentAvg.toFixed(1)} min`} s="Emergency and High" />
          <Stat k="Weighted waiting cost" v={Math.round(m.weightedCost)} s="path cost (lower is better)" />
          <Stat k="Decisions explained" v={m.explainedPct == null ? 'n/a' : `${m.explainedPct.toFixed(0)}%`} s={`bed use ${m.bedUtil.toFixed(0)}%, doctors ${m.docUtil.toFixed(0)}%`} />
        </div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Priority</th><th>Target</th><th>Patients</th><th>Within target</th><th>Mean wait</th></tr></thead><tbody>
          {classes.map((c) => (
            <tr key={c}><td><PriorityBadge level={c} /></td><td className="mono">{TARGET_MIN[c]} min</td><td>{m.byClass[c].n}</td>
              <td>{m.byClass[c].pct == null ? 'n/a' : `${m.byClass[c].pct.toFixed(0)}%`}</td><td className="mono">{f1(m.byClass[c].avg)} min</td></tr>
          ))}
        </tbody></table></div>
        <div style={{ marginTop: 12 }}><Explain title="Reading this">Targets come from the Prolog recommendations (High and Emergency under 10 minutes). A waiting patient counts as missed as soon as the target passes. Under heavy load Routine patients miss their target first, which is the intended trade-off of triage. Try the First-come-first-served policy in Reports &amp; settings and compare.</Explain></div>
      </Card>
    </div>
  );
}

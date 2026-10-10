import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { runJourney } from '../lib/patients.js';
import { NODE_BY_ID } from '../lib/graph.js';
import { infer, ROOM_SYSTEM } from '../lib/fuzzy.js';
import { train, generate, DEFAULT_CORPUS } from '../lib/ngram.js';
import { label } from '../lib/prolog.js';
import { Badge, Card } from '../components/ui.jsx';


export default function Journey() {
  const { patient } = usePatient();
  const [result, setResult] = useState(null);
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    let live = true;
    setResult(null); setShown(0);
    runJourney(patient).then((r) => live && setResult(r));
    return () => { live = false; };
  }, [patient, run]);

  useEffect(() => {
    if (!result) return undefined;
    const t = setInterval(() => setShown((s) => (s < 7 ? s + 1 : s)), 650);
    return () => clearInterval(t);
  }, [result]);

  const lm = useMemo(() => train(DEFAULT_CORPUS), []);

  const steps = result && [
    { n: 1, ps: 'Prolog', t: 'Arrival & triage', to: '/experiments/priority-triage',
      out: <><Badge level={result.triage.priority} /> {result.triage.recommendation}. Reason: <b>{label(result.triage.reasons[0] ?? '')}</b></> },
    { n: 2, ps: 'Fuzzy logic', t: 'Vital-sign monitoring', to: '/experiments/vitals',
      out: <><Badge level={result.vitals.label} /> Monitoring priority <b>{result.vitals.crisp.toFixed(0)}/100</b> from HR {patient.heartRate} bpm and {patient.temp}°C</> },
    { n: 3, ps: 'Neuro-fuzzy', t: 'Risk estimation', to: '/experiments/risk',
      out: <><Badge level={result.risk.category} /> Illustrative risk score <b>{result.risk.score}/100</b></> },
    { n: 4, ps: 'Prolog', t: 'Resource allocation', to: '/experiments/resource-management',
      out: <>Bed <b>{label(result.alloc.bed)}</b> · doctor <b>{label(result.alloc.doctor)}</b> · diagnostics <b>{label(result.alloc.diag)}</b></> },
    { n: 5, ps: result.route.algo === 'A*' ? 'A*' : 'BFS', t: `Route to ${NODE_BY_ID[result.dest].name}`, to: result.route.algo === 'A*' ? '/experiments/emergency-routing' : '/experiments/navigation',
      out: <>{result.route.path.map((p) => NODE_BY_ID[p].name).join(' → ')} <span className="muted">({result.route.cost} m, {result.route.algo})</span></> },
    { n: 6, ps: 'Fuzzy control', t: 'Room comfort', to: '/experiments/room', out: (() => {
      const act = { high: 9, medium: 5, low: 2 }[result.triage.priority];
      const r = infer(ROOM_SYSTEM, { ambient: 80, occupancy: 2, activity: act });
      return <>Ward lighting set to <b>{r.crisp.toFixed(0)}%</b> ({r.label}) for activity level {act}/10 at night</>;
    })() },
    { n: 7, ps: 'Trigram SLM', t: 'Patient information message', to: '/experiments/messages',
      out: <i>“{generate(lm, 'your', 'trigram', { temperature: 0 }).text}”</i> },
  ];

  return (
    <div className="grid g-main">
      <Card title="Patient journey" sub="Each step is computed by its own algorithm. Click a step to open that experiment."
        right={<button className="btn sm" onClick={() => setRun((r) => r + 1)}>Replay</button>}>
        <div className="journey">
          {!result && <div className="note">Running Prolog inference…</div>}
          {steps?.map((s, i) => (
            i < shown ? (
              <Link key={s.n} to={s.to} className="step">
                <div className="step-n">{s.n}</div>
                <div><h3>{s.t}</h3><div className="out">{s.out}</div></div>
                <div className="ps">{s.ps}</div>
              </Link>
            ) : (
              <div key={s.n} className="step" style={{ opacity: 0.4 }}>
                <div className="step-n">{s.n}</div>
                <div><h3>{s.t}</h3><div className="out">Waiting…</div></div>
                <div className="ps">{s.ps}</div>
              </div>
            )
          ))}
        </div>
      </Card>
      <Card title="Selected patient">
        <div className="hero-card" style={{ border: 0, padding: 0, background: 'none' }}>
          <dl>
            <dt>Name</dt><dd>{patient.name}</dd>
            <dt>Age / sex</dt><dd>{patient.age} · {patient.sex}</dd>
            <dt>Symptoms</dt><dd>{patient.symptoms.map(label).join(', ')}</dd>
            <dt>Vitals</dt><dd>HR {patient.heartRate} · {patient.temp}°C · BP {patient.sys}</dd>
            <dt>Condition</dt><dd style={{ textTransform: 'capitalize' }}>{patient.condition}</dd>
          </dl>
        </div>
        <div className="note" style={{ marginTop: 12 }}>Change the input patient in the bar above to re-run the journey.</div>
      </Card>
    </div>
  );
}

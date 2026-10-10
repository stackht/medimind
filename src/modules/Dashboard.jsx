import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { runJourney } from '../lib/patients.js';
import { NODE_BY_ID } from '../lib/graph.js';
import { infer, ROOM_SYSTEM } from '../lib/fuzzy.js';
import { train, generate, DEFAULT_CORPUS } from '../lib/ngram.js';
import { solve, DEFAULT_ASSETS, DEFAULT_PARAMS } from '../lib/minimax.js';
import { label } from '../lib/prolog.js';
import { Badge, Card } from '../components/ui.jsx';

const COVERAGE = [
  ['PS 1', 'Patient Navigation', 'BFS · DFS · state space', '/navigate'],
  ['PS 2', 'Priority Triage', 'Prolog facts & rules', '/triage'],
  ['PS 3', 'Resource Manager', 'Prolog knowledge base', '/resources'],
  ['PS 4', 'Emergency Router', 'A* search', '/emergency'],
  ['PS 5', 'Security Ops', 'Minimax game tree', '/security'],
  ['PS 6', 'Vitals Monitor', 'Fuzzy logic', '/vitals'],
  ['PS 7', 'Smart Room', 'Fuzzy control', '/room'],
  ['PS 8', 'Risk Estimator', 'Neuro-fuzzy (ANFIS)', '/risk'],
  ['PS 9', 'Patient Insights', 'Perceptron · Competitive', '/insights'],
  ['PS 10', 'Health Messages', 'Bigram · Trigram LM', '/messages'],
];

export default function Dashboard() {
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
  const sec = useMemo(() => solve(DEFAULT_ASSETS, DEFAULT_PARAMS, true), []);

  const steps = result && [
    { n: 1, ps: 'PS 2 · Prolog', t: 'Arrival & triage', to: '/triage',
      out: <><Badge level={result.triage.priority} /> {result.triage.recommendation}. Reason: <b>{label(result.triage.reasons[0] ?? '')}</b></> },
    { n: 2, ps: 'PS 6 · Fuzzy logic', t: 'Vital-sign monitoring', to: '/vitals',
      out: <><Badge level={result.vitals.label} /> Monitoring priority <b>{result.vitals.crisp.toFixed(0)}/100</b> from HR {patient.heartRate} bpm and {patient.temp}°C</> },
    { n: 3, ps: 'PS 8 · Neuro-fuzzy', t: 'Risk estimation', to: '/risk',
      out: <><Badge level={result.risk.category} /> Illustrative risk score <b>{result.risk.score}/100</b></> },
    { n: 4, ps: 'PS 3 · Prolog', t: 'Resource allocation', to: '/resources',
      out: <>Bed <b>{label(result.alloc.bed)}</b> · doctor <b>{label(result.alloc.doctor)}</b> · diagnostics <b>{label(result.alloc.diag)}</b></> },
    { n: 5, ps: result.route.algo === 'A*' ? 'PS 4 · A*' : 'PS 1 · BFS', t: `Route to ${NODE_BY_ID[result.dest].name}`, to: result.route.algo === 'A*' ? '/emergency' : '/navigate',
      out: <>{result.route.path.map((p) => NODE_BY_ID[p].name).join(' → ')} <span className="muted">({result.route.cost} m, {result.route.algo})</span></> },
    { n: 6, ps: 'PS 7 · Fuzzy control', t: 'Room comfort', to: '/room', out: (() => {
      const act = { high: 9, medium: 5, low: 2 }[result.triage.priority];
      const r = infer(ROOM_SYSTEM, { ambient: 80, occupancy: 2, activity: act });
      return <>Ward lighting set to <b>{r.crisp.toFixed(0)}%</b> ({r.label}) for activity level {act}/10 at night</>;
    })() },
    { n: 7, ps: 'PS 10 · Trigram SLM', t: 'Patient information message', to: '/messages',
      out: <i>“{generate(lm, 'your', 'trigram', { temperature: 0 }).text}”</i> },
  ];

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <h1>One patient, ten AI techniques.</h1>
          <p>MediMind follows a simulated patient from the front door to discharge. Every stage is solved by a different classical AI method, each implemented from scratch and explained step by step.</p>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn on" onClick={() => setRun((r) => r + 1)}>Replay journey simulation</button>
            <Link to="/triage" className="btn" style={{ textDecoration: 'none' }}>Start with triage</Link>
          </div>
        </div>
        <div className="hero-card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Current simulated patient</div>
          <dl>
            <dt>Name</dt><dd>{patient.name}</dd>
            <dt>Age / sex</dt><dd>{patient.age} · {patient.sex}</dd>
            <dt>Symptoms</dt><dd>{patient.symptoms.map(label).join(', ')}</dd>
            <dt>Vitals</dt><dd>HR {patient.heartRate} · {patient.temp}°C · BP {patient.sys}</dd>
            <dt>Condition</dt><dd style={{ textTransform: 'capitalize' }}>{patient.condition}</dd>
          </dl>
        </div>
      </section>

      <div className="grid g-main">
        <Card title="Patient journey (live simulation)" sub="Each step is computed by its module; click a step to explore it. Change the patient in the top bar to re-run.">
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

        <div className="stack">
          <Card title="Hospital-wide operations" sub="Not tied to one patient">
            <div className="stack" style={{ gap: 12 }}>
              <Link to="/security" className="step" style={{ gridTemplateColumns: '1fr' }}>
                <div className="ps">PS 5 · Minimax</div>
                <h3>Cyber-defence plan</h3>
                <div className="out">Optimal play yields utility <b>{sec.value}</b>. First move: <b>{sec.pv[0].move.label}</b>.</div>
              </Link>
              <Link to="/insights" className="step" style={{ gridTemplateColumns: '1fr' }}>
                <div className="ps">PS 9 · Perceptron &amp; Competitive learning</div>
                <h3>Record classification &amp; grouping</h3>
                <div className="out">Supervised classifier and unsupervised cluster discovery on synthetic records.</div>
              </Link>
            </div>
          </Card>
          <Card title="Problem statement coverage">
            <div className="cov">
              {COVERAGE.map(([ps, n, tech, to]) => (
                <Link key={ps} to={to}><b>{ps}</b><span><span style={{ fontWeight: 600 }}>{n}</span><br /><span className="muted">{tech}</span></span></Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

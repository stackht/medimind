import { cloneElement, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useSim } from '../context/SimContext.jsx';
import { usePatient } from '../context/PatientContext.jsx';
import { useToast } from '../components/feedback.jsx';
import { Card } from '../components/ui.jsx';
import { EXPERIMENTS } from '../experiments.jsx';
import { SCENARIOS } from '../lib/patients.js';
import { PRIORITY_LABEL } from '../lib/simData.js';

const FIELDS = ['age', 'sex', 'symptoms', 'pain', 'temp', 'heartRate', 'sys', 'bmi', 'glucose', 'condition', 'diag'];
const pad = (n) => String(n).padStart(2, '0');

export default function ExperimentsIndex() {
  const list = EXPERIMENTS.filter((e) => !e.extra);
  const journey = EXPERIMENTS.find((e) => e.extra);
  return (
    <div>
      <div className="page-title-row"><div><h1>AI experiments</h1><p>The ten problem statements this project implements. Each experiment keeps its own algorithm and can read the same synthetic patients as the live dashboard.</p></div></div>
      <div className="exp-grid">
        {list.map((e) => (
          <Link key={e.slug} to={`/experiments/${e.slug}`} className="exp-card">
            <span className="exp-num">EXPERIMENT {pad(e.n)}</span>
            <h3>{e.short}</h3>
            <div><span className="tag">{e.technique}</span></div>
            <p>{e.objective}</p>
            <span className="note"><Icon name="layers" size={13} /> {e.link}</span>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <Card title="End-to-end journey" sub={journey.objective} right={<Link to={`/experiments/${journey.slug}`} className="btn primary sm">Open journey</Link>} />
      </div>
    </div>
  );
}

export function ExperimentPage() {
  const { slug } = useParams();
  const exp = EXPERIMENTS.find((e) => e.slug === slug);
  const { snap, d } = useSim();
  const { patient, update, load } = usePatient();
  const toast = useToast();
  const [key, setKey] = useState(0);
  if (!exp) return <div className="empty"><b>Experiment not found</b><Link to="/experiments">Back to experiments</Link></div>;

  const idx = EXPERIMENTS.filter((e) => !e.extra).findIndex((e) => e.slug === slug);
  const all = EXPERIMENTS.filter((e) => !e.extra);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  const pick = (v) => {
    if (v.startsWith('sim:')) {
      const p = snap.patients.find((x) => x.id === v.slice(4));
      if (!p) return;
      update({ ...Object.fromEntries(FIELDS.map((f) => [f, p[f]])), name: p.id });
      toast(`Loaded ${p.id} from the live simulation`, 'info');
    } else { load(v.slice(7)); toast('Loaded preset scenario', 'info'); }
    setKey((k) => k + 1);
  };
  const current = SCENARIOS.find((s) => s.name === patient.name)?.key;
  const selValue = snap.patients.some((p) => p.id === patient.name) ? `sim:${patient.name}` : current ? `preset:${current}` : '';

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row spread" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="exp-num">{exp.extra ? 'EXTRA' : `EXPERIMENT ${pad(exp.n)}`} · <span className="tag">{exp.technique}</span></div>
            <h1 style={{ fontSize: 20, margin: '6px 0 4px' }}>{exp.title}</h1>
            <p style={{ color: 'var(--ink-2)', maxWidth: '78ch' }}><b>Objective.</b> {exp.objective}</p>
            <p className="note" style={{ marginTop: 6 }}><Icon name="layers" size={13} /> {exp.link}</p>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          {exp.patient && (
            <label className="row note">Input patient
              <select className="input-sm" value={selValue} onChange={(e) => pick(e.target.value)} aria-label="Choose input patient">
                {!selValue && <option value="">Custom (edited)</option>}
                <optgroup label="Live simulation">
                  {d.active.filter((p) => p.status !== 'triage').slice(0, 25).map((p) => <option key={p.id} value={`sim:${p.id}`}>{p.id} · {p.dept} · {PRIORITY_LABEL[p.priority]}</option>)}
                </optgroup>
                <optgroup label="Preset scenarios">{SCENARIOS.map((s) => <option key={s.key} value={`preset:${s.key}`}>{s.title}</option>)}</optgroup>
              </select>
            </label>
          )}
          <button className="btn" onClick={() => { if (exp.patient) load('chest'); setKey((k) => k + 1); toast('Experiment reset to defaults', 'info'); }}><Icon name="reset" size={15} />Reset experiment</button>
          <span className="note" style={{ marginLeft: 'auto' }}>Results recompute live as inputs change. Use the controls inside for Play and Train.</span>
        </div>
      </div>
      <div className="exp-body">{cloneElement(exp.el, { key })}</div>
      <div className="row spread" style={{ marginTop: 20 }}>
        {prev ? <Link to={`/experiments/${prev.slug}`} className="btn"><Icon name="chevleft" size={15} />{prev.short}</Link> : <span />}
        {next ? <Link to={`/experiments/${next.slug}`} className="btn">{next.short}<Icon name="chevron" size={15} /></Link> : <span />}
      </div>
    </div>
  );
}

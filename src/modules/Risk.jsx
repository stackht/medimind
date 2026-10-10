import { useEffect, useMemo, useRef, useState } from 'react';
import { usePatient } from '../context/PatientContext.jsx';
import { Anfis, FEATURES, genRiskData, mulberry32, norm, riskCategory, splitData } from '../lib/anfis.js';
import { Badge, Card, Explain, PageHeader, Slider, Stat } from '../components/ui.jsx';
import { LineChart, MembershipChart, Scatter } from '../components/charts.jsx';

const MAX_EPOCHS = 100;

// Turn the model's Gaussian MFs for one input into a plottable fuzzy variable (raw units).
const gaussVar = (f, c, s) => ({
  label: f.label, range: [f.min, f.max],
  sets: Object.fromEntries(c.map((ci, j) => [j === 0 ? 'low' : 'high', { type: 'gauss', p: [f.min + ci * (f.max - f.min), s[j] * (f.max - f.min)] }])),
});

export default function Risk() {
  const { patient, update } = usePatient();
  const data = useMemo(() => splitData(genRiskData()), []);
  const model = useRef(null);
  const rnd = useRef(mulberry32(5));
  const initial = useRef(null);
  if (!model.current) { model.current = new Anfis(); initial.current = model.current.snapshot(); }
  const [hist, setHist] = useState(() => ({ train: [model.current.rmse(data.train.X, data.train.y)], test: [model.current.rmse(data.test.X, data.test.y)] }));
  const [running, setRunning] = useState(true); // start learning immediately so the effect is visible
  const epochs = hist.train.length - 1;

  const step = (n = 1) => {
    const m = model.current;
    const tr = [], te = [];
    for (let i = 0; i < n; i++) { m.epoch(data.train.X, data.train.y, rnd.current); tr.push(m.rmse(data.train.X, data.train.y)); te.push(m.rmse(data.test.X, data.test.y)); }
    setHist((h) => ({ train: [...h.train, ...tr], test: [...h.test, ...te] }));
  };
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => { step(1); }, 110);
    return () => clearInterval(id);
  });
  useEffect(() => { if (running && epochs >= MAX_EPOCHS) setRunning(false); }, [running, epochs]);
  const reset = () => {
    setRunning(false); model.current = new Anfis(); initial.current = model.current.snapshot(); rnd.current = mulberry32(5);
    setHist({ train: [model.current.rmse(data.train.X, data.train.y)], test: [model.current.rmse(data.test.X, data.test.y)] });
  };

  const m = model.current;
  const x = FEATURES.map((f) => norm(f, patient[f.key]));
  const fw = m.forward(x);
  const score = Math.round(Math.min(1, Math.max(0, fw.y)) * 100);
  const cat = riskCategory(score);
  const top = fw.w.map((w, k) => ({ k, wn: w / fw.W, f: fw.f[k] })).sort((a, b) => b.wn - a.wn).slice(0, 4);
  const points = data.test.X.map((xi, i) => ({ x: data.test.y[i] * 10, y: m.predict(xi) * 10, color: '#0b7a8f' }));

  return (
    <div className="stack">
      <PageHeader ps="PS 8 · Hybrid Neuro-Fuzzy Patient Risk Estimation" title="Risk Estimator: Neural Learning meets Fuzzy Reasoning"
        desc="A five-layer ANFIS network: fuzzy membership functions and linear if-then rules form the structure, and gradient-descent back-propagation (neural learning) tunes them from a synthetic, de-identified dataset."
        tags={['Artificial neural network', 'Fuzzy inference (Takagi–Sugeno)', 'Hybrid neuro-fuzzy', 'Back-propagation']} />

      <div className="grid g-main">
        <div className="stack">
          <Card title="Training" sub={`${data.train.X.length} training and ${data.test.X.length} held-out synthetic records · 4 inputs × 2 fuzzy sets = 16 rules`}
            right={<div className="row">
              <button className="btn sm primary" disabled={epochs >= MAX_EPOCHS} onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Train'}</button>
              <button className="btn sm" disabled={epochs >= MAX_EPOCHS} onClick={() => { setRunning(false); step(Math.min(60, MAX_EPOCHS - epochs)); }}>+60 epochs</button>
              <button className="btn sm" onClick={reset}>Reset</button>
            </div>}>
            <div className="grid g3" style={{ gap: 10, marginBottom: 12 }}>
              <Stat k="Epoch" v={epochs} s={`of ${MAX_EPOCHS}`} />
              <Stat k="Train RMSE" v={hist.train.at(-1).toFixed(3)} />
              <Stat k="Test RMSE" v={hist.test.at(-1).toFixed(3)} s="unseen records" />
            </div>
            <LineChart series={[{ name: 'Train RMSE', data: hist.train }, { name: 'Test RMSE', data: hist.test, color: '#e08a1e' }]} yLabel="RMSE" />
          </Card>
          <Card title="Predicted vs actual risk (held-out records)" sub="Points near the diagonal mean accurate predictions. Axes are risk score ÷ 10.">
            <div style={{ maxWidth: 440 }}><Scatter points={points} line={{ w: [1, -1], b: 0 }} xLabel="actual risk ÷ 10" yLabel="predicted risk ÷ 10" /></div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Estimate for the current patient" sub="Inputs are shared with the other modules.">
            {FEATURES.map((f) => <Slider key={f.key} label={f.label} unit={f.unit} min={f.min} max={f.max} step={f.key === 'bmi' ? 0.5 : 1} value={patient[f.key]} onChange={(v) => update({ [f.key]: v })} />)}
            <div className="row spread">
              <div><div className="note">Illustrative risk score</div><div style={{ fontFamily: 'var(--font-head)', fontSize: 36, fontWeight: 800 }}>{score}<span className="muted" style={{ fontSize: 16 }}>/100</span></div></div>
              <Badge level={cat}><span style={{ fontSize: 16 }}>{cat} risk</span></Badge>
            </div>
            <div className="bar" style={{ marginTop: 10, height: 10 }}><i style={{ width: `${score}%`, background: cat === 'high' ? 'var(--high)' : cat === 'medium' ? 'var(--med)' : 'var(--low)' }} /></div>
          </Card>
          <Card title="Strongest fuzzy rules for this patient" sub="Normalised firing strength × linear consequent.">
            <table className="tbl"><tbody>
              {top.map((t) => (
                <tr key={t.k}>
                  <td className="note">IF {FEATURES.map((f, i) => `${f.key} ${m.idx[t.k][i] ? 'high' : 'low'}`).join(', ')}</td>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{(t.wn * 100).toFixed(0)}%</td><td className="mono" style={{ whiteSpace: 'nowrap' }}>→ {(t.f * 100).toFixed(0)}</td>
                </tr>
              ))}
            </tbody></table>
          </Card>
        </div>
      </div>

      <Card title="Learned membership functions" sub="Curves show the current fuzzy sets. Train the network and watch them move and reshape to fit the data.">
        <div className="grid g4">
          {FEATURES.map((f, i) => (
            <div key={f.key}>
              <MembershipChart variable={gaussVar(f, m.c[i], m.s[i])} value={patient[f.key]} title={`${f.label} (${f.unit})`} height={130} />
              <div className="note" style={{ marginTop: 4 }}>start centres {initial.current.c[i].map((c) => (f.min + c * (f.max - f.min)).toFixed(0)).join(' / ')} → now {m.c[i].map((c) => (f.min + c * (f.max - f.min)).toFixed(0)).join(' / ')}</div>
            </div>
          ))}
        </div>
      </Card>
      <Explain>Layer 1 fuzzifies each input with Gaussian sets (low/high). Layer 2 multiplies memberships to get each rule’s strength. Layer 3 normalises. Layer 4 applies each rule’s linear formula. Layer 5 sums the weighted outputs. Training back-propagates the error to update both the consequent coefficients and the centres and widths of the membership functions. Data are synthetic and the score is illustrative only.</Explain>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { genPerceptronData, trainPerceptron, perceptronPredict, genClusterData, trainCompetitive, purity } from '../lib/learn.js';
import { Card, Explain, PageHeader, PlayerBar, Seg, Slider, Stat, usePlayer } from '../components/ui.jsx';
import { Scatter } from '../components/charts.jsx';

const C0 = '#2f9e66', C1 = '#c93a31';
const CL = ['#0b7a8f', '#e08a1e', '#7b5cc9'];

function PerceptronLab() {
  const [eta, setEta] = useState(0.05);
  const [spread, setSpread] = useState(1.45);
  const data = useMemo(() => genPerceptronData(70, 3, spread), [spread]);
  const hist = useMemo(() => trainPerceptron(data, { eta, epochs: 40 }), [data, eta]);
  const player = usePlayer(hist.length, 450);
  const h = hist[player.i];
  const [test, setTest] = useState([]);
  useEffect(() => { player.last(); }, [hist]); // open on the trained result; Reset + Play replays learning
  const acc = 1 - h.errors / data.length;
  const pts = [
    ...data.map((d) => ({ x: d.x, y: d.y, color: d.label ? C1 : C0, shape: perceptronPredict(h, d.x, d.y) !== d.label ? 'square' : 'circle', stroke: perceptronPredict(h, d.x, d.y) !== d.label ? '#12303b' : '#fff' })),
    ...test.map((t) => ({ x: t.x, y: t.y, color: perceptronPredict(hist.at(-1), t.x, t.y) ? C1 : C0, stroke: '#12303b' })),
  ];
  return (
    <div className="grid g-main">
      <Card title="Perceptron: supervised classification" sub="Labelled synthetic records: routine care (green) vs intensive care (red). Squares are currently misclassified. Click the plot to classify a new record.">
        <Scatter points={pts} line={{ w: h.w, b: h.b }} xLabel="Vital-sign instability index" yLabel="Lab abnormality index"
          onClick={(x, y) => setTest([...test.slice(-4), { x, y }])} />
        <div className="legend"><span><i className="dot" style={{ background: C0 }} />Routine care</span><span><i className="dot" style={{ background: C1 }} />Intensive care</span><span>Dashed line = decision boundary after epoch {h.epoch}</span></div>
        <div style={{ marginTop: 12 }}><PlayerBar player={player} length={hist.length} label="Epoch" /></div>
      </Card>
      <div className="stack">
        <Card title="Learning rule">
          <div className="grid g3" style={{ gap: 10, marginBottom: 12 }}>
            <Stat k="Epoch" v={h.epoch} />
            <Stat k="Errors" v={h.errors} s={`of ${data.length}`} />
            <Stat k="Accuracy" v={`${(acc * 100).toFixed(0)}%`} />
          </div>
          <Slider label="Learning rate η" unit="" min={0.01} max={0.5} step={0.01} value={eta} onChange={setEta} />
          <Slider label="Class overlap (spread)" unit="" min={0.6} max={2.4} step={0.05} value={spread} onChange={setSpread} />
          <div className="mono" style={{ marginBottom: 10 }}>w = [{h.w[0].toFixed(2)}, {h.w[1].toFixed(2)}]  b = {h.b.toFixed(2)}</div>
          <Explain title="Perceptron rule">Output = 1 if w·x + b ≥ 0 else 0. For each wrong prediction: <b>w ← w + η (target − output) x</b>. Correct records change nothing, so the boundary moves only when it makes a mistake. If classes overlap, it may never reach zero errors.</Explain>
        </Card>
        {test.length > 0 && <Card title="New records you classified"><table className="tbl"><tbody>{test.map((t, i) => <tr key={i}><td className="mono">({t.x.toFixed(1)}, {t.y.toFixed(1)})</td><td><b>{perceptronPredict(hist.at(-1), t.x, t.y) ? 'Intensive care' : 'Routine care'}</b></td></tr>)}</tbody></table></Card>}
      </div>
    </div>
  );
}

function CompetitiveLab() {
  const [k] = useState(3);
  const [eta, setEta] = useState(0.3);
  const data = useMemo(() => genClusterData(), []);
  const hist = useMemo(() => trainCompetitive(data, { k, eta, epochs: 15 }), [data, k, eta]);
  const player = usePlayer(hist.length, 600);
  useEffect(() => { player.last(); }, [hist]); // open on the trained result; Reset + Play replays learning
  const h = hist[player.i];
  const pts = data.map((d, i) => ({ x: d.x, y: d.y, color: CL[h.assign[i]] }));
  const protos = h.protos.map((p, i) => ({ x: p[0], y: p[1], color: CL[i] }));
  const sizes = CL.map((_, c) => h.assign.filter((a) => a === c).length);
  const trace = hist.map((s) => s.protos);
  return (
    <div className="grid g-main">
      <Card title="Competitive learning: unsupervised grouping" sub="No labels are used. Three prototype neurons compete for each record; the winner moves toward it.">
        <Scatter points={pts} protos={protos} xLabel="Visit frequency index" yLabel="Care intensity index" />
        <div className="legend">{CL.map((c, i) => <span key={c}><i className="dot" style={{ background: c }} />Group {i + 1} ({sizes[i]})</span>)}<span>Rings = prototype neurons</span></div>
        <div style={{ marginTop: 12 }}><PlayerBar player={player} length={hist.length} label="Epoch" /></div>
      </Card>
      <div className="stack">
        <Card title="Winner-takes-all">
          <div className="grid g2" style={{ gap: 10, marginBottom: 12 }}>
            <Stat k="Epoch" v={h.epoch} />
            <Stat k="Purity (check only)" v={`${(purity(data, h.assign) * 100).toFixed(0)}%`} s="vs hidden truth" />
          </div>
          <Slider label="Initial learning rate η" unit="" min={0.05} max={0.8} step={0.05} value={eta} onChange={setEta} />
          <table className="tbl" style={{ marginBottom: 10 }}><thead><tr><th>Prototype</th><th>Start</th><th>Now</th></tr></thead><tbody>
            {h.protos.map((p, i) => <tr key={i}><td><i className="dot" style={{ background: CL[i] }} /> Group {i + 1}</td><td className="mono">({trace[0][i][0].toFixed(1)}, {trace[0][i][1].toFixed(1)})</td><td className="mono">({p[0].toFixed(1)}, {p[1].toFixed(1)})</td></tr>)}
          </tbody></table>
          <Explain title="Competitive rule">For each record find the nearest prototype (the winner) and move only that one: <b>w ← w + η (x − w)</b>. η decays each epoch so prototypes settle at group centres. Labels are used only afterwards to measure purity, never during learning.</Explain>
        </Card>
      </div>
    </div>
  );
}

export default function Insights() {
  const [tab, setTab] = useState('perceptron');
  return (
    <div className="stack">
      <PageHeader title="Patient Insights: Perceptron and Competitive Learning"
        desc="Two views of the same idea. Supervised: a perceptron learns to separate labelled patient categories. Unsupervised: competitive learning discovers groups of similar records with no labels at all."
        tags={['Perceptron learning rule', 'Supervised learning', 'Competitive learning', 'Unsupervised clustering']} />
      <Seg value={tab} onChange={setTab} options={[['perceptron', 'Perceptron (supervised)'], ['competitive', 'Competitive learning (unsupervised)']]} />
      {tab === 'perceptron' ? <PerceptronLab /> : <CompetitiveLab />}
    </div>
  );
}

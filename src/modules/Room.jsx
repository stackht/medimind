import { useMemo, useState } from 'react';
import { infer, inferSugeno, ROOM_SYSTEM } from '../lib/fuzzy.js';
import { Card, Explain, PageHeader, Seg, Slider, Stat } from '../components/ui.jsx';
import { LineChart, MembershipChart } from '../components/charts.jsx';

const PRESETS = [
  { name: 'Night rest', ambient: 15, occupancy: 1, activity: 1 },
  { name: 'Morning rounds', ambient: 420, occupancy: 4, activity: 5 },
  { name: 'Bright afternoon visit', ambient: 850, occupancy: 3, activity: 2 },
  { name: 'Procedure at night', ambient: 30, occupancy: 5, activity: 9 },
  { name: 'Empty room', ambient: 200, occupancy: 0, activity: 0 },
];
const SWEEPS = {
  ambient: { label: 'Ambient light', unit: 'lux', min: 0, max: 1000 },
  occupancy: { label: 'Room occupancy', unit: 'people', min: 0, max: 6 },
  activity: { label: 'Activity level', unit: '/10', min: 0, max: 10 },
};

const peak = (s) => (s.type === 'tri' ? s.p[1] : (s.p[1] + s.p[2]) / 2);

function RoomScene({ intensity, ambient, occupancy }) {
  const people = Math.round(occupancy);
  return (
    <div className="room">
      <svg viewBox="0 0 480 290" role="img" aria-label={`Hospital room lit at ${intensity.toFixed(0)} percent`}>
        <defs>
          <radialGradient id="glow" cx="50%" cy="0%" r="90%">
            <stop offset="0%" stopColor="#fff3c4" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff3c4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="480" height="290" fill="#22343d" />
        <rect y="210" width="480" height="80" fill="#2c424c" />
        <rect x="330" y="40" width="110" height="90" rx="6" fill="#9ed3e8" opacity={0.15 + (ambient / 1000) * 0.85} stroke="#4c6573" strokeWidth="4" />
        <line x1="385" y1="40" x2="385" y2="130" stroke="#4c6573" strokeWidth="3" />
        <rect x="50" y="150" width="190" height="80" rx="8" fill="#e8f1f4" />
        <rect x="50" y="130" width="40" height="100" rx="8" fill="#c3d6de" />
        <rect x="60" y="140" width="60" height="30" rx="10" fill="#fff" />
        <circle cx="240" cy="30" r="14" fill="#fff6d6" opacity={0.3 + intensity / 150} />
        <rect x="0" y="0" width="480" height="290" fill="url(#glow)" opacity={intensity / 100} />
        <rect width="480" height="290" fill="#fff4cf" opacity={(intensity / 100) * 0.28} />
        {Array.from({ length: people }).map((_, i) => (
          <g key={i} transform={`translate(${280 + (i % 3) * 52 - (Math.floor(i / 3) * 14)} ${200 + Math.floor(i / 3) * 34})`}>
            <circle cy="-30" r="10" fill="#f0c8a0" />
            <rect x="-11" y="-18" width="22" height="34" rx="9" fill={i % 2 ? '#3a8fa0' : '#5aa07a'} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Room() {
  const [v, setV] = useState(PRESETS[1]);
  const [method, setMethod] = useState('mamdani');
  const [sweepKey, setSweepKey] = useState('ambient');
  const inputs = { ambient: v.ambient, occupancy: v.occupancy, activity: v.activity };
  const mam = useMemo(() => infer(ROOM_SYSTEM, inputs), [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const sug = useMemo(() => inferSugeno(ROOM_SYSTEM, inputs), [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const [amb, occ, act] = ROOM_SYSTEM.inputs;
  const active = mam.fired.filter((f) => f.strength > 0.001).sort((a, b) => b.strength - a.strength);
  const set = (k) => (x) => setV({ ...v, [k]: x });
  const shown = method === 'mamdani' ? mam.crisp : sug.crisp;

  // sweep one input while the other two stay fixed, and compare the two inference methods
  const sweep = useMemo(() => {
    const s = SWEEPS[sweepKey]; const n = 41; const m = [], g = [];
    for (let i = 0; i < n; i++) {
      const x = s.min + ((s.max - s.min) * i) / (n - 1);
      const inp = { ...inputs, [sweepKey]: x };
      m.push(infer(ROOM_SYSTEM, inp, 101).crisp); g.push(inferSugeno(ROOM_SYSTEM, inp).crisp);
    }
    const diffs = m.map((a, i) => Math.abs(a - g[i]));
    return { m, g, mad: diffs.reduce((a, b) => a + b, 0) / n, max: Math.max(...diffs) };
  }, [v, sweepKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useMemo(() => PRESETS.map((p) => {
    const i = { ambient: p.ambient, occupancy: p.occupancy, activity: p.activity };
    return { ...p, m: infer(ROOM_SYSTEM, i).crisp, s: inferSugeno(ROOM_SYSTEM, i).crisp };
  }), []);

  return (
    <div className="stack">
      <PageHeader title="Smart Room Lighting with Mamdani and Sugeno FIS"
        desc="Two fuzzy inference systems control room lighting from the same three imprecise inputs and the same 27 rules. Mamdani clips fuzzy output sets and takes their centroid; Sugeno gives each rule a crisp constant and takes a weighted average. Compare their outputs."
        tags={['Mamdani FIS', 'Sugeno FIS', 'Rule-based control', '27 rules']} />

      <div className="grid g-side">
        <div className="stack">
          <Card title="Sensor inputs (simulated)">
            <div className="chips" style={{ marginBottom: 14 }}>
              {PRESETS.map((p) => <button key={p.name} className="chip" onClick={() => setV(p)}>{p.name}</button>)}
            </div>
            <Slider label="Ambient light" unit="lux" min={0} max={1000} step={5} value={v.ambient} onChange={set('ambient')} />
            <Slider label="Room occupancy" unit="people" min={0} max={6} step={0.5} value={v.occupancy} onChange={set('occupancy')} />
            <Slider label="Activity level" unit="/10" min={0} max={10} step={0.5} value={v.activity} onChange={set('activity')} />
          </Card>
          <div className="grid g3" style={{ gap: 10 }}>
            <Stat k="Mamdani" v={`${mam.crisp.toFixed(1)}%`} s={`mostly “${mam.label}”`} />
            <Stat k="Sugeno" v={`${sug.crisp.toFixed(1)}%`} s="weighted average" />
            <Stat k="Difference" v={`${Math.abs(mam.crisp - sug.crisp).toFixed(1)}`} s="percentage points" />
          </div>
        </div>
        <Card title="Room preview" sub="Brightness follows the selected controller." right={<Seg value={method} onChange={setMethod} options={[['mamdani', 'Mamdani'], ['sugeno', 'Sugeno']]} />}>
          <RoomScene intensity={shown} ambient={v.ambient} occupancy={v.occupancy} />
        </Card>
      </div>

      <div className="grid g3">
        <Card><MembershipChart variable={amb} value={v.ambient} title={`${amb.label} (${amb.unit})`} height={140} /></Card>
        <Card><MembershipChart variable={occ} value={v.occupancy} title={`${occ.label}`} height={140} /></Card>
        <Card><MembershipChart variable={act} value={v.activity} title={`${act.label}`} height={140} /></Card>
      </div>

      <div className="grid g2">
        <Card title="Mamdani: aggregated output" sub="Clipped rule consequents merged; the red line is the centroid.">
          <MembershipChart variable={ROOM_SYSTEM.output} curve={mam.curve} crisp={mam.crisp} height={170} />
        </Card>
        <Card title="Sugeno: rule constants" sub="Each rule outputs a constant; the result is sum(w·z) / sum(w).">
          <table className="tbl"><thead><tr><th>Output label</th><th>Constant z</th><th>Mamdani set peak</th></tr></thead><tbody>
            {Object.entries(ROOM_SYSTEM.output.sugeno).map(([k, z]) => <tr key={k}><td style={{ textTransform: 'capitalize' }}>{k}</td><td className="mono">{z}</td><td className="mono">{peak(ROOM_SYSTEM.output.sets[k])}</td></tr>)}
          </tbody></table>
          <div className="note" style={{ marginTop: 8 }}>Sugeno result: Σ(w·z) = {sug.fired.reduce((a, f) => a + f.strength * f.z, 0).toFixed(2)}, Σw = {sug.fired.reduce((a, f) => a + f.strength, 0).toFixed(2)} → {sug.crisp.toFixed(1)}%</div>
        </Card>
      </div>

      <Card title="Comparing the two systems" sub="Vary one input while the other two stay at their current values."
        right={<Seg value={sweepKey} onChange={setSweepKey} options={Object.entries(SWEEPS).map(([k, s]) => [k, s.label])} />}>
        <LineChart series={[{ name: 'Mamdani (centroid)', data: sweep.m, color: '#0b7f8f' }, { name: 'Sugeno (weighted average)', data: sweep.g, color: '#e0841b' }]}
          yLabel="lighting %" xLabel={`${SWEEPS[sweepKey].label}: ${SWEEPS[sweepKey].min} to ${SWEEPS[sweepKey].max} ${SWEEPS[sweepKey].unit}`} height={190} />
        <div className="grid g3" style={{ gap: 10, marginTop: 10 }}>
          <Stat k="Mean absolute difference" v={sweep.mad.toFixed(1)} s="points over the sweep" />
          <Stat k="Largest difference" v={sweep.max.toFixed(1)} s="points" />
          <Stat k="Rules firing now" v={active.length} s="of 27" />
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Preset scenarios">
          <table className="tbl"><thead><tr><th>Scenario</th><th>Mamdani</th><th>Sugeno</th><th>Difference</th></tr></thead><tbody>
            {table.map((r) => <tr key={r.name}><td>{r.name}</td><td className="mono">{r.m.toFixed(1)}%</td><td className="mono">{r.s.toFixed(1)}%</td><td className="mono">{Math.abs(r.m - r.s).toFixed(1)}</td></tr>)}
          </tbody></table>
        </Card>
        <Card title="Rules firing now">
          <div className="scroll" style={{ maxHeight: 230 }}><table className="tbl"><tbody>
            {active.map((f) => (
              <tr key={f.i}>
                <td>{f.rule.if.ambient} light, {f.rule.if.occupancy}, {f.rule.if.activity} → <b>{f.rule.then}</b></td>
                <td className="mono">{f.strength.toFixed(2)}</td>
              </tr>
            ))}
          </tbody></table></div>
        </Card>
      </div>
      <Explain title="Mamdani vs Sugeno">Both use the same fuzzification and the same rules. Mamdani keeps linguistic output sets, so its result needs aggregation and centroid defuzzification (more computation, smoother and easier to read). Sugeno replaces each output set with a constant, so the result is a simple weighted average (cheaper, easy to tune or learn, which is why ANFIS is built on it). Here they agree closely, with the largest gaps at the ends where Mamdani’s output sets cannot reach the extremes of the scale.</Explain>
    </div>
  );
}

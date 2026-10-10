import { useMemo, useState } from 'react';
import { infer, ROOM_SYSTEM } from '../lib/fuzzy.js';
import { Card, Explain, PageHeader, Slider, Stat } from '../components/ui.jsx';
import { MembershipChart } from '../components/charts.jsx';

const PRESETS = [
  { name: 'Night rest', ambient: 15, occupancy: 1, activity: 1 },
  { name: 'Morning rounds', ambient: 420, occupancy: 4, activity: 5 },
  { name: 'Bright afternoon visit', ambient: 850, occupancy: 3, activity: 2 },
  { name: 'Procedure at night', ambient: 30, occupancy: 5, activity: 9 },
  { name: 'Empty room', ambient: 200, occupancy: 0, activity: 0 },
];

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
  const out = useMemo(() => infer(ROOM_SYSTEM, { ambient: v.ambient, occupancy: v.occupancy, activity: v.activity }), [v]);
  const [amb, occ, act] = ROOM_SYSTEM.inputs;
  const active = out.fired.filter((f) => f.strength > 0.001).sort((a, b) => b.strength - a.strength);
  const set = (k) => (x) => setV({ ...v, [k]: x });

  return (
    <div className="stack">
      <PageHeader title="Smart Room Lighting with Fuzzy Logic"
        desc="A fuzzy controller sets room lighting from three imprecise inputs: how bright it already is, how many people are present, and how demanding the activity is. The output blends smoothly instead of switching between a few fixed levels."
        tags={['Fuzzy control', 'Membership functions', '27 rules', 'Centroid defuzzification']} />

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
          <div className="grid g2">
            <Stat k="Lighting intensity" v={`${out.crisp.toFixed(0)}%`} s={`mostly “${out.label}”`} />
            <Stat k="Rules active" v={active.length} s="of 27" />
          </div>
        </div>
        <Card title="Room preview" sub="Brightness follows the controller output.">
          <RoomScene intensity={out.crisp} ambient={v.ambient} occupancy={v.occupancy} />
        </Card>
      </div>

      <div className="grid g3">
        <Card><MembershipChart variable={amb} value={v.ambient} title={`${amb.label} (${amb.unit})`} height={140} /></Card>
        <Card><MembershipChart variable={occ} value={v.occupancy} title={`${occ.label}`} height={140} /></Card>
        <Card><MembershipChart variable={act} value={v.activity} title={`${act.label}`} height={140} /></Card>
      </div>

      <div className="grid g2">
        <Card title="Aggregated output" sub="Clipped rule consequents merged; the red line is the centroid.">
          <MembershipChart variable={ROOM_SYSTEM.output} curve={out.curve} crisp={out.crisp} height={170} />
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
      <Explain>Rule logic: busier activities need more light, a dark room needs more and a bright room less, a crowded room adds a step, and an empty room dims to “off” (or a low prep light before a procedure).</Explain>
    </div>
  );
}

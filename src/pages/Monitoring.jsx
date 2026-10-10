import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSim } from '../context/SimContext.jsx';
import { PatientDrawer, PriorityBadge, SimControls } from '../components/dash.jsx';
import { Card, Seg } from '../components/ui.jsx';
import { ROOM_SYSTEM, infer } from '../lib/fuzzy.js';

const LEVELS = ['critical', 'urgent', 'watch', 'routine'];
const LEVEL_COLOR = { critical: 'var(--bad)', urgent: 'var(--orange)', watch: 'var(--warn)', routine: 'var(--ok)' };

// ambient light from the simulated clock: dark at night, brightest around noon
const lux = (tick) => {
  const h = (((8 * 60 + tick) / 60) % 24 + 24) % 24;
  return h > 6 && h < 18 ? Math.round(900 * Math.sin((Math.PI * (h - 6)) / 12)) : 20;
};

export default function Monitoring() {
  const { snap, d } = useSim();
  const [level, setLevel] = useState('all');
  const [openId, setOpenId] = useState(null);
  const monitored = useMemo(() => d.active.filter((p) => p.vitals).sort((a, b) => b.vitals.score - a.vitals.score), [d.active]);
  const counts = Object.fromEntries(LEVELS.map((l) => [l, monitored.filter((p) => p.vitals.label === l).length]));
  const shown = level === 'all' ? monitored : monitored.filter((p) => p.vitals.label === level);
  const ambient = lux(snap.tick);
  const rooms = d.byDept.map((x) => {
    const people = Math.min(6, x.waiting + x.treating + (x.treating ? 1 : 0));
    const patients = d.active.filter((p) => p.dept === x.dept);
    const activity = Math.min(10, 2 + x.treating * 3 + (patients.some((p) => p.priority === 'emergency') ? 3 : 0));
    const out = infer(ROOM_SYSTEM, { ambient, occupancy: people, activity });
    return { ...x, people, activity, out };
  });

  return (
    <div>
      <div className="page-title-row"><div><h1>Patient monitoring</h1><p>Heart rate and temperature of every active patient are interpreted by a fuzzy inference system that produces an illustrative monitoring priority.</p></div></div>
      <SimControls compact />
      <div className="grid g4" style={{ marginBottom: 16 }}>
        {LEVELS.map((l) => (
          <div key={l} className="stat" style={{ borderLeft: `4px solid ${LEVEL_COLOR[l]}` }}>
            <div className="k" style={{ textTransform: 'capitalize' }}>{l}</div><div className="v">{counts[l]}</div><div className="s">fuzzy monitoring priority</div>
          </div>
        ))}
      </div>

      <Card title="Live vitals" right={<Seg value={level} onChange={setLevel} options={[['all', 'All'], ...LEVELS.map((l) => [l, l[0].toUpperCase() + l.slice(1)])]} />}
        sub="Sorted by monitoring score. Click a card for the full patient record.">
        {shown.length === 0 ? <div className="empty"><b>No patients to show</b>{monitored.length ? 'No patient is in this category right now.' : 'Start the simulation or add a patient.'}</div> : (
          <div className="vital-grid">
            {shown.slice(0, 18).map((p) => (
              <button key={p.id} className={`vital-card ${p.vitals.label === 'critical' ? 'critical' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpenId(p.id)}>
                <div className="row spread nowrap"><b>{p.id}</b><span className={`badge b-${p.vitals.label}`}>{p.vitals.label}</span></div>
                <div className="note">{p.dept} · <PriorityBadge level={p.priority} /></div>
                <div className="row" style={{ gap: 20 }}>
                  <div><div className="note">Heart rate</div><div className="vital-num">{p.heartRate}<small>bpm</small></div></div>
                  <div><div className="note">Temperature</div><div className="vital-num">{p.temp.toFixed(1)}<small>°C</small></div></div>
                </div>
                <div><div className="row spread note"><span>Monitoring priority</span><b>{p.vitals.score.toFixed(0)}/100</b></div><div className="bar"><i style={{ width: `${p.vitals.score}%`, background: LEVEL_COLOR[p.vitals.label] }} /></div></div>
              </button>
            ))}
          </div>
        )}
        {shown.length > 18 && <div className="note" style={{ marginTop: 10 }}>Showing the 18 highest of {shown.length}.</div>}
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Room environment" sub={`Fuzzy lighting controller per department room. Ambient light follows the simulated clock (${ambient} lux at ${snap.clock}).`}
          right={<Link to="/experiments/room" className="btn sm">Open experiment</Link>}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Room</th><th>Occupancy</th><th>Activity</th><th>Lighting</th><th>Fuzzy set</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.dept}>
                  <td><b>{r.dept}</b></td><td>{r.people} people</td><td>{r.activity.toFixed(0)}/10</td>
                  <td style={{ minWidth: 140 }}><div className="row nowrap"><div className="bar" style={{ flex: 1 }}><i style={{ width: `${r.out.crisp}%` }} /></div><b className="mono">{r.out.crisp.toFixed(0)}%</b></div></td>
                  <td style={{ textTransform: 'capitalize' }}>{r.out.label}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      </div>
      {openId && <PatientDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

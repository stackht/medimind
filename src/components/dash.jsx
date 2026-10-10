import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useSim } from '../context/SimContext.jsx';
import { useConfirm, useToast } from './feedback.jsx';
import { PRIORITY_LABEL, clockLabel, explainReason, resName } from '../lib/simData.js';
import { label } from '../lib/prolog.js';
import { NODE_BY_ID } from '../lib/graph.js';

export const COLORS = { teal: '#0e8fa1', navy: '#14305a', amber: '#e0a21b', orange: '#e8710a', red: '#d6382f', green: '#1f9d62', blue: '#3b6fd4', grey: '#c3cedb' };
export const PRIORITY_COLOR = { routine: COLORS.green, moderate: COLORS.amber, high: COLORS.orange, emergency: COLORS.red };
export const STATUS_LABEL = { triage: 'Triage', waiting: 'Waiting', treating: 'In treatment', discharged: 'Discharged' };

export const PriorityBadge = ({ level }) => <span className={`badge b-${level}`}>{PRIORITY_LABEL[level] ?? level}</span>;
export const StatusBadge = ({ status }) => <span className={`badge b-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
export const waitOf = (p, tick) => (p.status === 'waiting' || p.status === 'triage' ? Math.max(0, tick - p.arrivalTick) : p.waited ?? 0);

export function KpiCard({ icon, tone = '', label: text, tip, value, unit, foot }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-label" data-tip={tip} tabIndex={tip ? 0 : undefined}>{text}{tip && <Icon name="info" size={13} className="muted" />}</span>
        <span className={`kpi-icon ${tone}`}><Icon name={icon} size={17} /></span>
      </div>
      <div className="kpi-val">{value}{unit && <small> {unit}</small>}</div>
      <div className="kpi-foot">{foot}</div>
    </div>
  );
}

export function Trend({ delta, invert = false, unit = '' }) {
  if (!delta) return <span className="trend-flat">no change</span>;
  const up = delta > 0;
  const bad = invert ? !up : up;
  return <span className={bad ? 'trend-up' : 'trend-down'}><Icon name={up ? 'arrowUp' : 'arrowDown'} size={12} /> {Math.abs(delta)}{unit} vs 10 min ago</span>;
}

// ---------- simulation controls ----------
export function SimControls({ compact = false }) {
  const { snap, sim } = useSim();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState('');
  const running = snap.running;
  const run = async (key, fn) => { setBusy(key); try { await fn(); } finally { setBusy(''); } };

  const add = () => run('add', async () => {
    const p = await sim.addPatient();
    if (p) toast(`${p.id} triaged as ${PRIORITY_LABEL[p.priority]} (Prolog rule base)`);
  });
  const emergency = () => run('emg', async () => {
    const p = await sim.triggerEmergency();
    if (p) toast(`Emergency: ${p.id} (${p.dept}). A* route calculated.`, 'error');
  });
  const reset = async () => {
    const ok = await confirm({ title: 'Reset the simulation?', message: 'All patients, alerts, events and resource changes will be cleared and the simulation restarts from the seeded starting state.', confirmLabel: 'Reset', danger: true });
    if (ok) { sim.reset(); toast('Simulation reset', 'info'); }
  };

  return (
    <div className="sim-bar" role="toolbar" aria-label="Simulation controls">
      <button className="btn primary" onClick={() => (running ? sim.pause() : sim.start())} disabled={!snap.ready}>
        <Icon name={running ? 'pause' : 'play'} size={15} />{running ? 'Pause' : 'Start'} simulation
      </button>
      <button className="btn" onClick={reset} disabled={!snap.ready}><Icon name="reset" size={15} />Reset</button>
      <span className="sep" />
      <span className="note">Speed</span>
      <div className="seg" role="group" aria-label="Simulation speed">
        {[1, 2, 4, 8].map((s) => <button key={s} className={snap.settings.speed === s ? 'on' : ''} onClick={() => sim.setSpeed(s)} aria-pressed={snap.settings.speed === s}>{s}x</button>)}
      </div>
      <span className="sep" />
      <button className="btn" onClick={add} disabled={!snap.ready || busy === 'add'}><Icon name="plus" size={15} />{busy === 'add' ? 'Triaging…' : 'Add patient'}</button>
      <button className="btn alert" onClick={emergency} disabled={!snap.ready || busy === 'emg'}><Icon name="siren" size={15} />{busy === 'emg' ? 'Routing…' : 'Trigger emergency'}</button>
      {!compact && <Link to="/resources" className="btn"><Icon name="bed" size={15} />Adjust resources</Link>}
      <span className="spacer" />
      <span className="note"><Icon name="clock" size={13} /> Sim time <b className="mono">{snap.clock}</b> · {snap.running ? 'running' : 'paused'}</span>
    </div>
  );
}

// ---------- charts ----------
export function HBars({ rows, max, legend }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.segments.reduce((a, s) => a + s.value, 0)));
  return (
    <div>
      {rows.map((r) => {
        const total = r.segments.reduce((a, s) => a + s.value, 0);
        return (
          <div className="hbar-row" key={r.label}>
            <span title={r.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <div className="hbar-track" data-tip={r.tip ?? r.segments.map((s) => `${s.name}: ${s.value}`).join('\n')} tabIndex={0} role="img" aria-label={`${r.label}: ${r.segments.map((s) => `${s.name} ${s.value}`).join(', ')}`}>
              {r.segments.map((s) => <i key={s.name} style={{ width: `${(s.value / top) * 100}%`, background: s.color }} />)}
            </div>
            <span className="hbar-val">{r.valueText ?? total}</span>
          </div>
        );
      })}
      {legend && <div className="legend" style={{ marginTop: 8 }}>{legend.map((l) => <span key={l.name}><i className="dot" style={{ background: l.color }} />{l.name}</span>)}</div>}
    </div>
  );
}

export function VBars({ data, unit = '' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const empty = data.every((d) => d.value === 0);
  if (empty) return <div className="empty"><b>No data yet</b>Start the simulation or add patients.</div>;
  return (
    <div className="vbars" role="img" aria-label={data.map((d) => `${d.name}: ${d.value}`).join(', ')}>
      {data.map((d) => (
        <div className="vbar" key={d.name}>
          <span className="num">{d.value}</span>
          <div className="col" data-tip={`${d.name}: ${d.value}${unit}`} tabIndex={0} style={{ height: `${(d.value / max) * 100}%`, background: d.color ?? COLORS.teal }} />
          <span className="nm">{d.name}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <div className="empty"><b>No data yet</b>Priorities appear as patients are triaged.</div>;
  const R = 52, C = 2 * Math.PI * R;
  const offs = data.map((_, i) => data.slice(0, i).reduce((acc, x) => acc + (x.value / total) * C, 0));
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" role="img" aria-label={data.map((d) => `${d.name} ${d.value}`).join(', ')}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eaeff5" strokeWidth="18" />
        {data.map((d, i) => {
          if (!d.value) return null;
          const len = (d.value / total) * C;
          const off = offs[i];
          return <circle key={d.name} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)"><title>{`${d.name}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title></circle>;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="700" fill="#0f2744">{total}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="10.5" fill="#7a8ba0">patients</text>
      </svg>
      <div className="donut-legend">
        {data.map((d) => <div key={d.name}><i className="dot" style={{ background: d.color }} />{d.name}<b>{d.value}</b></div>)}
      </div>
    </div>
  );
}

export function TimeSeries({ series, ticks, height = 190, yMax, unit = '', minPoints = 3 }) {
  const [hover, setHover] = useState(null);
  const n = series[0]?.points.length ?? 0;
  if (n < minPoints) return <div className="empty"><b>Collecting data</b>Press Start. The chart fills as simulated minutes pass.</div>;
  const W = 560, H = height, pad = { l: 34, r: 12, t: 10, b: 24 };
  const top = yMax ?? Math.max(1, ...series.flatMap((s) => s.points)) * 1.15;
  const sx = (i) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const sy = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((x - pad.l) / (W - pad.l - pad.r)) * (n - 1)))));
  };
  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label={series.map((s) => s.name).join(', ')}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(top * g)} y2={sy(top * g)} stroke="#e2e8f0" />
            <text x={pad.l - 6} y={sy(top * g) + 4} fontSize="10.5" textAnchor="end" fill="#7a8ba0">{Math.round(top * g)}</text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            {s.area && <polygon fill={s.color} opacity="0.1" points={`${sx(0)},${sy(0)} ${s.points.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')} ${sx(n - 1)},${sy(0)}`} />}
            <polyline fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" points={s.points.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')} />
          </g>
        ))}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => <text key={i} x={sx(i)} y={H - 6} fontSize="10.5" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fill="#7a8ba0">{clockLabel(ticks[i])}</text>)}
        {hover != null && <line x1={sx(hover)} x2={sx(hover)} y1={pad.t} y2={H - pad.b} stroke="#14305a" strokeDasharray="3 3" />}
        {hover != null && series.map((s) => <circle key={s.name} cx={sx(hover)} cy={sy(s.points[hover])} r="4" fill="#fff" stroke={s.color} strokeWidth="2" />)}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(sx(hover) / W) * 100}%`, top: 8 }}>
          {clockLabel(ticks[hover])} · {series.map((s) => `${s.name} ${s.points[hover]}${unit}`).join(' · ')}
        </div>
      )}
      <div className="legend" style={{ marginTop: 4 }}>{series.map((s) => <span key={s.name}><i className="dot" style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}

// ---------- activity feed ----------
const KIND_ICON = { patient: 'users', system: 'layers' };
export function EventFeed({ events, empty = 'Nothing has happened yet.' }) {
  if (!events.length) return <div className="empty"><b>No activity</b>{empty}</div>;
  return (
    <div className="feed">
      {events.map((e) => (
        <div className="feed-item" key={e.id}>
          <span className={`feed-ico ${e.kind === 'system' ? 'sys' : ''}`}><Icon name={KIND_ICON[e.kind] ?? 'layers'} size={15} /></span>
          <div className="feed-text">
            <div>{e.text}</div>
            <div className="feed-meta">
              <span className="mono">{clockLabel(e.t)}</span>
              {e.algo && <span className="algo-tag" data-tip={e.why} tabIndex={e.why ? 0 : undefined}>{e.algo}</span>}
              {e.why && <span>{e.why}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- triage explanation (used in drawer and triage page) ----------
export function TriageExplain({ p }) {
  if (!p.prolog) return <div className="empty"><b>Triage in progress</b>The Prolog rule base is evaluating this patient.</div>;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row spread">
        <div>
          <div className="note">System-suggested priority</div>
          <PriorityBadge level={p.priority} />{p.override && <span className="tag neutral" style={{ marginLeft: 8 }}>manual override</span>}
        </div>
        <span className="algo-tag">Algorithm: Prolog rule base</span>
      </div>
      <div>
        <div className="lbl" style={{ marginBottom: 4 }}>Factors used</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {p.prolog.reasons.map((r) => <li key={r}>{explainReason(r)}</li>)}
          <li>Age {p.age}, pain {p.pain}/10, temperature {p.temp} °C</li>
        </ul>
      </div>
      <div><div className="lbl">Recommended assessment</div><div>{p.prolog.recommendation}</div></div>
      <div className="disclosure"><Icon name="info" size={15} /><span>Educational decision support from a simulated rule base. It is not a medical diagnosis and must not guide real care.</span></div>
    </div>
  );
}

// ---------- patient drawer ----------
export function PatientDrawer({ id, onClose }) {
  const { snap, sim } = useSim();
  const toast = useToast();
  const navigate = useNavigate();
  const p = snap.patients.find((x) => x.id === id);
  if (!p) return null;
  const events = snap.events.filter((e) => e.patientId === id).slice(-8).reverse();
  const wait = waitOf(p, snap.tick);
  return (
    <div className="drawer-wrap" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Patient ${p.id}`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h3>{p.id} <span className="muted" style={{ fontWeight: 500 }}>· synthetic patient</span></h3>
            <div className="row" style={{ marginTop: 6 }}><PriorityBadge level={p.priority} /><StatusBadge status={p.status} /><span className="tag neutral">{p.dept}</span></div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="drawer-body">
          <dl className="kv">
            <dt>Age / sex</dt><dd>{p.age} · {p.sex}</dd>
            <dt>Symptoms</dt><dd>{p.symptoms.map(label).join(', ')}</dd>
            <dt>Arrived</dt><dd>{clockLabel(p.arrivalTick)} · waited {wait} min</dd>
            <dt>Vitals</dt><dd>HR {p.heartRate} bpm · {p.temp} °C · BP {p.sys}</dd>
            {p.vitals && <><dt>Fuzzy monitor</dt><dd>{p.vitals.score.toFixed(0)}/100 · <span style={{ textTransform: 'capitalize' }}>{p.vitals.label}</span></dd></>}
            {p.risk && <><dt>Neuro-fuzzy risk</dt><dd>{p.risk.score}/100 · <span style={{ textTransform: 'capitalize' }}>{p.risk.category}</span></dd></>}
            <dt>Resources</dt><dd>{p.bedId ? `${resName(p.bedId)} · ${resName(p.doctorId)}${p.diagId ? ` · ${resName(p.diagId)}` : p.diagStatus === 'queued' ? ' · diagnostics queued' : ''}` : 'Not yet allocated'}</dd>
          </dl>
          <div><h4 style={{ marginBottom: 8 }}>Triage decision</h4><TriageExplain p={p} /></div>
          <div className="row">
            {p.status !== 'discharged' && p.priority !== 'emergency' && <button className="btn alert" onClick={() => { sim.setPriority(p.id, 'emergency'); toast(`${p.id} escalated to Emergency`, 'error'); }}><Icon name="siren" size={15} />Escalate to emergency</button>}
            {p.status === 'treating' && <button className="btn" onClick={() => { sim.discharge(p.id); toast(`${p.id} discharged`); onClose(); }}>Discharge now</button>}
            <button className="btn" onClick={() => { onClose(); navigate('/triage', { state: { openId: p.id } }); }}>Open in Triage</button>
          </div>
          <div><h4 style={{ marginBottom: 6 }}>Patient timeline</h4><EventFeed events={events} empty="No events for this patient yet." /></div>
        </div>
      </aside>
    </div>
  );
}

export const routeNames = (path) => path.map((n) => NODE_BY_ID[n].name);

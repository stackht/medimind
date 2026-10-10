import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useSim } from '../context/SimContext.jsx';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { Card, Seg, Slider } from '../components/ui.jsx';
import { clockLabel, PRIORITY_LABEL } from '../lib/simData.js';
import { setReduceMotion, useReduceMotion } from '../lib/prefs.js';

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports() {
  const { snap, sim, d } = useSim();
  const toast = useToast();
  const confirm = useConfirm();
  const reduce = useReduceMotion();
  const [seed, setSeed] = useState(snap.settings.seed);

  const patientsCsv = () => {
    download('medimind-patients.csv', toCsv([
      ['id', 'department', 'arrival_time', 'priority', 'status', 'waited_min', 'age', 'sex', 'symptoms', 'triage_algorithm', 'triage_reason', 'bed', 'doctor'],
      ...snap.patients.map((p) => [p.id, p.dept, clockLabel(p.arrivalTick), PRIORITY_LABEL[p.priority], p.status, p.status === 'waiting' ? snap.tick - p.arrivalTick : p.waited ?? '', p.age, p.sex, p.symptoms.join(' '), 'Prolog rule base', p.prolog?.reasons[0] ?? '', p.bedId ?? '', p.doctorId ?? '']),
    ]), 'text/csv');
    toast('Patients CSV downloaded');
  };
  const eventsCsv = () => {
    download('medimind-events.csv', toCsv([['time', 'type', 'event', 'algorithm', 'reason'], ...snap.events.map((e) => [clockLabel(e.t), e.kind, e.text, e.algo ?? '', e.why ?? ''])]), 'text/csv');
    toast('Event log CSV downloaded');
  };
  const json = () => {
    download('medimind-snapshot.json', JSON.stringify({ exportedFor: 'MediMind educational simulation (synthetic data)', settings: snap.settings, tick: snap.tick, patients: snap.patients.map(({ prolog, ...p }) => ({ ...p, prolog: prolog && { priority: prolog.priority, reasons: prolog.reasons } })), alerts: snap.alerts, events: snap.events }, null, 2), 'application/json');
    toast('JSON snapshot downloaded');
  };
  const resetAll = async (applySeed) => {
    const ok = await confirm({ title: 'Reset the simulation?', message: applySeed ? `The simulation restarts with seed ${seed}. All current patients, alerts and events are cleared.` : 'All current patients, alerts and events are cleared.', confirmLabel: 'Reset', danger: true });
    if (!ok) return;
    if (applySeed) sim.setSeed(Number(seed));
    sim.reset();
    toast('Simulation reset', 'info');
  };
  const emergencies = snap.patients.filter((p) => p.priority === 'emergency').length;

  return (
    <div>
      <div className="page-title-row"><div><h1>Reports &amp; settings</h1><p>Export the synthetic data produced by the simulation and tune how it behaves.</p></div></div>
      <div className="grid g2">
        <Card title="Summary" sub={`Simulation time ${snap.clock}, ${snap.running ? 'running' : 'paused'}.`}>
          <table className="tbl"><tbody>
            {[['Patients arrived', d.totalArrived], ['Currently waiting', d.waiting.length], ['In treatment', d.treating.length], ['Discharged', d.discharged.length],
              ['Emergency-priority patients', emergencies], ['Average wait', `${d.avgWait} min`], ['Longest wait', `${d.maxWait} min`], ['Bed occupancy', `${d.bedsUsed} of ${d.bedsTotal}`], ['Alerts raised', snap.alerts.length], ['Logged events', snap.events.length]].map(([k, v]) => (
              <tr key={k}><td>{k}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{v}</td></tr>
            ))}
          </tbody></table>
        </Card>
        <Card title="Downloads" sub="All exports contain synthetic data only.">
          <div className="stack" style={{ gap: 10 }}>
            <button className="btn" onClick={patientsCsv} disabled={!snap.patients.length}><Icon name="download" size={15} />Patients (CSV)</button>
            <button className="btn" onClick={eventsCsv} disabled={!snap.events.length}><Icon name="download" size={15} />Event log (CSV)</button>
            <button className="btn" onClick={json} disabled={!snap.patients.length}><Icon name="download" size={15} />Full snapshot (JSON)</button>
          </div>
        </Card>
        <Card title="Simulation settings">
          <Slider label="Patient arrival rate" unit="per minute" min={0.05} max={0.8} step={0.05} value={snap.settings.arrivalRate} onChange={(v) => sim.setArrivalRate(v)} fmt={(v) => v.toFixed(2)} />
          <div className="field"><label>Default speed</label><Seg value={snap.settings.speed} onChange={(s) => sim.setSpeed(s)} options={[[1, '1x'], [2, '2x'], [4, '4x'], [8, '8x']]} /></div>
          <div className="field"><label>Random seed (applied on reset)</label>
            <div className="row nowrap"><input type="number" min="1" value={seed} onChange={(e) => setSeed(e.target.value)} aria-label="Random seed" /><button className="btn" onClick={() => resetAll(true)} disabled={!(Number(seed) >= 1)}>Apply and reset</button></div>
          </div>
          <div className="note">The same seed always produces the same patients, which makes demos repeatable.</div>
        </Card>
        <Card title="Interface and data">
          <label className="check"><input type="checkbox" checked={reduce} onChange={(e) => setReduceMotion(e.target.checked)} />Reduce motion (disable transitions)</label>
          <div className="note" style={{ marginBottom: 14 }}>Also follows your system’s reduced-motion setting automatically.</div>
          <button className="btn danger" onClick={() => resetAll(false)}><Icon name="reset" size={15} />Reset simulation</button>
        </Card>
      </div>
    </div>
  );
}

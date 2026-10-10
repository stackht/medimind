import Icon from '../components/Icon.jsx';
import { useSim } from '../context/SimContext.jsx';
import { COLORS, EventFeed, KpiCard, SimControls, TimeSeries } from '../components/dash.jsx';
import { useToast } from '../components/feedback.jsx';
import { Card } from '../components/ui.jsx';
import { resName } from '../lib/simData.js';

function Stepper({ name, value, used, onChange }) {
  return (
    <div className="row spread nowrap" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <div><div style={{ fontWeight: 600 }}>{name}</div><div className="note">{used} in use · {value - used} free</div></div>
      <div className="row nowrap" style={{ gap: 6 }}>
        <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label={`Remove one ${name}`} onClick={() => onChange(value - 1)} disabled={value <= 0}><Icon name="minus" size={14} /></button>
        <b style={{ minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{value}</b>
        <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label={`Add one ${name}`} onClick={() => onChange(value + 1)} disabled={value >= 12}><Icon name="plus" size={14} /></button>
      </div>
    </div>
  );
}

const group = (list, field) => {
  const m = new Map();
  list.forEach((x) => { const a = m.get(x[field]) ?? { total: 0, used: 0 }; a.total++; if (!x.free) a.used++; m.set(x[field], a); });
  return [...m.entries()];
};

export default function ResourcesPage() {
  const { snap, sim, d } = useSim();
  const toast = useToast();
  const res = snap.resources;
  const change = (kind, key, n) => { const r = sim.setCapacity(kind, key, n); toast(r.message, r.ok ? 'success' : 'error'); };
  const allocEvents = snap.events.filter((e) => e.algo === 'Prolog allocation rules' || e.algo === 'Operator setting').slice(-8).reverse();
  const hist = snap.history;
  const diagsFree = res.diags.filter((x) => x.free).length;

  return (
    <div>
      <div className="page-title-row"><div><h1>Hospital resources</h1><p>Beds, doctors and diagnostic units. Prolog rules allocate them to waiting patients, most urgent first. Change capacity to see the queue react.</p></div></div>
      <SimControls compact />
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <KpiCard icon="bed" tone={d.bedsFree === 0 ? 'bad' : 'ok'} label="Beds free" value={d.bedsFree} unit={`/ ${d.bedsTotal}`} foot={`${Math.round((100 * d.bedsUsed) / Math.max(1, d.bedsTotal))}% occupied`} />
        <KpiCard icon="stethoscope" tone={d.doctorsFree === 0 ? 'warn' : 'ok'} label="Doctors free" value={d.doctorsFree} unit={`/ ${d.doctorsTotal}`} foot="A doctor is busy for the first 40% of a stay" />
        <KpiCard icon="layers" label="Diagnostics free" value={diagsFree} unit={`/ ${res.diags.length}`} foot="Scanner or lab slot is held for 6 minutes" />
        <KpiCard icon="clock" tone={d.waiting.length > 5 ? 'warn' : ''} label="Waiting for a bed" value={d.waiting.length} foot={d.waiting.length ? `Longest wait ${d.maxWait} min` : 'Nobody waiting'} />
      </div>

      <div className="grid g3">
        <Card title="Beds" sub="Adjust capacity per ward type.">
          {group(res.beds, 'type').map(([t, v]) => <Stepper key={t} name={resName(t)} value={v.total} used={v.used} onChange={(n) => change('beds', t, n)} />)}
        </Card>
        <Card title="Doctors on duty" sub="Per specialty.">
          {group(res.doctors, 'specialty').map(([t, v]) => <Stepper key={t} name={resName(t)} value={v.total} used={v.used} onChange={(n) => change('doctors', t, n)} />)}
        </Card>
        <Card title="Diagnostics" sub="Scanners and lab benches.">
          {group(res.diags, 'type').map(([t, v]) => <Stepper key={t} name={resName(t)} value={v.total} used={v.used} onChange={(n) => change('diags', t, n)} />)}
        </Card>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <Card title="Bed map" sub="Teal = occupied. Hover or focus a bed for the patient.">
          {Object.keys(d.bedsByType).map((t) => (
            <div key={t} style={{ marginBottom: 12 }}>
              <div className="lbl" style={{ marginBottom: 5 }}>{resName(t)}</div>
              <div className="bed-grid">
                {res.beds.filter((b) => b.type === t).map((b) => {
                  const pt = snap.patients.find((x) => x.id === b.patientId);
                  return <span key={b.id} className={`bed ${b.free ? '' : 'used'} ${pt?.priority === 'emergency' ? 'hot' : ''}`} tabIndex={0} data-tip={b.free ? `${resName(b.id)}: free` : `${resName(b.id)}: ${b.patientId} (${pt?.dept ?? ''})`}>{b.free ? '' : b.patientId.slice(2)}</span>;
                })}
                {d.bedsByType[t].total === 0 && <span className="note">No beds of this type</span>}
              </div>
            </div>
          ))}
        </Card>
        <Card title="Doctors" sub="Who is busy and with whom.">
          <div className="stack" style={{ gap: 6 }}>
            {res.doctors.map((x) => (
              <div key={x.id} className="row spread nowrap"><span>{resName(x.id)}</span><span className={`badge ${x.free ? 'b-ok' : 'b-treating'}`}>{x.free ? 'Free' : x.patientId}</span></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <Card title="Resource utilization over time" sub="Share of beds and doctors in use.">
          <TimeSeries ticks={hist.map((h) => h.t)} yMax={100} series={[{ name: 'Bed occupancy %', color: COLORS.teal, area: true, points: hist.map((h) => h.util) }, { name: 'Doctors busy %', color: COLORS.blue, points: hist.map((h) => h.docUtil) }]} unit="%" />
        </Card>
        <Card title="Allocation decisions" sub="Prolog allocation rules and capacity changes.">
          <EventFeed events={allocEvents} empty="Start the simulation to see allocations." />
        </Card>
      </div>
    </div>
  );
}

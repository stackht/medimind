import { useEffect, useState } from 'react';
import { usePatient } from '../context/PatientContext.jsx';
import { DEFAULT_RESOURCES, CONDITIONS, DIAGS } from '../lib/patients.js';
import { allocateAll, classifyPatient, label, RESOURCE_RULES } from '../lib/prolog.js';
import { Badge, Card, Code, Explain, PageHeader } from '../components/ui.jsx';

let uid = 10;
const PRIOS = ['high', 'medium', 'low'];
const sel = (value, onChange, options) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} style={{ border: '1px solid var(--line-strong)', borderRadius: 8, padding: '4px 6px', maxWidth: 130 }}>
    {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
  </select>
);

export default function Resources({ fromSim = null }) {
  const { patient } = usePatient();
  const [res, setRes] = useState(fromSim?.resources ?? DEFAULT_RESOURCES);
  const [queue, setQueue] = useState(fromSim?.queue ?? [
    { id: 1, name: 'Walk-in A', priority: 'low', condition: 'general', diag: 'none' },
    { id: 2, name: 'Ambulance case', priority: 'high', condition: 'trauma', diag: 'ct' },
    { id: 3, name: 'Referral', priority: 'medium', condition: 'respiratory', diag: 'xray' },
  ]);
  const [out, setOut] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    allocateAll(res, queue).then((r) => live && (setOut(r), setErr(''))).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [res, queue]);

  const flip = (kind, id) => setRes({ ...res, [kind]: res[kind].map((r) => (r.id === id ? { ...r, free: !r.free } : r)) });
  const edit = (id, patch) => setQueue(queue.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const addCurrent = async () => {
    const t = await classifyPatient(patient);
    setQueue([...queue, { id: ++uid, name: patient.name, priority: t.priority, condition: patient.condition, diag: patient.diag }]);
  };

  const usedBeds = new Set(out.map((o) => o.bed)), usedDocs = new Set(out.map((o) => o.doctor)), usedDx = new Set(out.map((o) => o.diag));
  const chip = (r, kind, used, text) => (
    <button key={r.id} className={`chip ${r.free ? '' : 'on'}`} onClick={() => flip(kind, r.id)} style={r.free ? (used.has(r.id) ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand-ink)' } : {}) : { background: '#8fa1ab', borderColor: '#8fa1ab' }}
      title="Click to toggle availability">{text}{used.has(r.id) ? ' ✓' : ''}</button>
  );

  return (
    <div className="stack">
      <PageHeader title="Resource Manager with Prolog"
        desc="Beds, doctors and diagnostic units are Prolog facts. Allocation rules match each simulated patient’s needs to what is currently free, with fallback rules (for example a step-down bed when the ICU is full). Patients are served most urgent first."
        tags={['Prolog', 'Knowledge representation', 'Rule-based reasoning', 'Allocation rules']} />

      <div className="grid g-side">
        <Card title="Resource availability" sub="Click to mark a resource occupied (grey) or free. Teal ✓ = assigned this round.">
          <div className="lbl" style={{ margin: '4px 0 6px' }}>Beds</div>
          <div className="chips">{res.beds.map((b) => chip(b, 'beds', usedBeds, `${label(b.id)}`))}</div>
          <div className="lbl" style={{ margin: '14px 0 6px' }}>Doctors</div>
          <div className="chips">{res.doctors.map((d) => chip(d, 'doctors', usedDocs, `${label(d.id)} · ${label(d.specialty)}`))}</div>
          <div className="lbl" style={{ margin: '14px 0 6px' }}>Diagnostics</div>
          <div className="chips">{res.diags.map((d) => chip(d, 'diags', usedDx, label(d.id)))}</div>
        </Card>

        <Card title="Patient queue" sub="Edit simulated needs; results update through the Prolog rules."
          right={<div className="row"><button className="btn sm" onClick={addCurrent}>+ Current patient</button><button className="btn sm" onClick={() => setQueue([...queue, { id: ++uid, name: `Patient ${uid}`, priority: 'medium', condition: 'general', diag: 'none' }])}>+ Add</button></div>}>
          {err && <div className="explain" style={{ borderColor: 'var(--high)', background: 'var(--high-soft)', marginBottom: 10 }}>{err}</div>}
          <div className="scroll" style={{ maxHeight: 'none' }}><table className="tbl">
            <thead><tr><th>Patient</th><th>Priority</th><th>Condition</th><th>Needs</th><th /></tr></thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id}>
                  <td><b>{q.name}</b></td>
                  <td>{sel(q.priority, (v) => edit(q.id, { priority: v }), PRIOS)}</td>
                  <td>{sel(q.condition, (v) => edit(q.id, { condition: v }), CONDITIONS)}</td>
                  <td>{sel(q.diag, (v) => edit(q.id, { diag: v }), DIAGS)}</td>
                  <td><button className="btn sm" onClick={() => setQueue(queue.filter((x) => x.id !== q.id))} aria-label={`Remove ${q.name}`}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      </div>

      <Card title="Allocation recommendations" sub="Processed in priority order: high, then medium, then low. Each assigned resource is removed from the free pool for the next patient.">
        <div className="scroll" style={{ maxHeight: 'none' }}><table className="tbl">
          <thead><tr><th>Order</th><th>Patient</th><th>Priority</th><th>Bed</th><th>Doctor</th><th>Diagnostic</th></tr></thead>
          <tbody>
            {out.map((o, i) => {
              const none = (v) => (v === 'none' || v === 'queued' ? <span className="badge b-warn">{v === 'none' ? 'none free' : 'queued'}</span> : <b>{label(v)}</b>);
              const dxNone = o.patient.diag === 'none';
              return (
                <tr key={o.patient.id}>
                  <td>{i + 1}</td><td><b>{o.patient.name}</b></td><td><Badge level={o.patient.priority} /></td>
                  <td>{none(o.bed)}</td><td>{none(o.doctor)}</td><td>{dxNone ? <span className="muted">not required</span> : none(o.diag)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <div style={{ marginTop: 14 }}><Explain>For each patient Prolog proves <span className="mono">allocation(P, Bed, Doctor, Diag)</span>. The first matching clause wins (cut). If the preferred bed type is full, a fallback clause tries the next type; if nothing is free the answer is <span className="mono">none</span> or <span className="mono">queued</span>.</Explain></div>
      </Card>

      <Card title="Allocation rules (Prolog)"><Code>{RESOURCE_RULES}</Code></Card>
    </div>
  );
}

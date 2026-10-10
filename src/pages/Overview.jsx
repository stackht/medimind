import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useSim } from '../context/SimContext.jsx';
import { COLORS, EventFeed, HBars, KpiCard, PatientDrawer, PriorityBadge, SimControls, Trend, waitOf } from '../components/dash.jsx';
import { Card } from '../components/ui.jsx';
import { clockLabel, resName } from '../lib/simData.js';


function Decision({ title, algo, text, why, t, empty }) {
  return (
    <div className="decision">
      <div className="row spread"><b>{title}</b>{algo && <span className="algo-tag">{algo}</span>}</div>
      {text ? <><div>{text} <span className="mono muted">{clockLabel(t)}</span></div><div className="why">{why}</div></> : <div className="note">{empty}</div>}
    </div>
  );
}

export default function Overview() {
  const { snap, d } = useSim();
  const [openId, setOpenId] = useState(null);
  const busiest = d.busiest;
  const critical = d.active.filter((p) => p.vitals && (p.vitals.label === 'critical' || p.vitals.label === 'urgent'));
  const topRisk = [...d.active].filter((p) => p.risk).sort((a, b) => b.risk.score - a.risk.score)[0];
  const alerts = [...snap.alerts].filter((a) => !a.resolved).reverse().slice(0, 4);
  const patientEvents = snap.events.filter((e) => e.kind === 'patient').slice(-7).reverse();
  const systemEvents = snap.events.filter((e) => e.kind === 'system').slice(-5).reverse();
  const res = snap.resources;

  return (
    <div>
      <div className="page-title-row">
        <div>
          <h1>Hospital operations</h1>
          <p>A live educational simulation. Patients are synthetic and every decision below is made by the project’s own AI algorithms.</p>
        </div>
      </div>
      <SimControls />

      {!snap.ready ? (
        <div className="empty"><b>Preparing simulation…</b>Seeding patients and running the Prolog triage rules.</div>
      ) : (
        <>
          <div className="kpis">
            <KpiCard icon="users" label="Total patients" tip="Everyone who has arrived since the simulation started, including those already discharged." value={d.totalArrived}
              foot={`${d.treating.length} in treatment · ${d.discharged.length} discharged`} />
            <KpiCard icon="clock" tone={d.waiting.length > 5 ? 'warn' : ''} label="Patients waiting" tip="Triaged patients still waiting for a bed and doctor." value={d.waiting.length}
              foot={<Trend delta={d.trend.waiting} />} />
            <KpiCard icon="bed" tone={d.bedsFree === 0 ? 'bad' : d.bedsFree <= 2 ? 'warn' : 'ok'} label="Available beds" tip="Free beds across ICU, HDU, ward and day care." value={d.bedsFree} unit={`/ ${d.bedsTotal}`}
              foot={`${Math.round((100 * d.bedsUsed) / Math.max(1, d.bedsTotal))}% occupied`} />
            <KpiCard icon="siren" tone={d.activeEmergencies.length ? 'bad' : 'ok'} label="Active emergencies" tip="Patients with Emergency priority who have not been discharged." value={d.activeEmergencies.length}
              foot={d.activeEmergencies.length ? <Link to="/routing">View routing</Link> : 'No emergencies'} />
            <KpiCard icon="layers" tone={busiest?.level === 'high' ? 'bad' : busiest?.level === 'moderate' ? 'warn' : 'ok'} label="Department workload" tip={'Active patients per doctor in the busiest department.\nUnder 1.5 normal, 1.5 to 3 busy, over 3 overloaded.'}
              value={busiest ? busiest.ratio.toFixed(1) : '0'} unit="per doctor" foot={busiest ? `Busiest: ${busiest.dept}` : ''} />
          </div>

          <div className="grid g-dash">
            <div className="stack">
              <Card className="flush">
                <div className="row spread" style={{ padding: '16px 20px 4px' }}><div className="card-title">Patient queue overview</div><Link to="/patients" className="btn sm">View all patients</Link></div>
                <div className="card-sub" style={{ padding: '0 20px' }}>Sorted by priority, then arrival time.</div>
                {d.waiting.length === 0 ? (
                  <div style={{ padding: '0 20px 20px' }}><div className="empty"><b>Nobody is waiting</b>{snap.running ? 'New arrivals will appear here.' : 'Press Start or add a patient.'}</div></div>
                ) : (
                  <div className="tbl-wrap"><table className="tbl">
                    <thead><tr><th>Patient</th><th>Department</th><th>Priority</th><th>Waiting</th><th /></tr></thead>
                    <tbody>
                      {d.waiting.slice(0, 6).map((p) => (
                        <tr key={p.id} className="clickable" onClick={() => setOpenId(p.id)}>
                          <td><b>{p.id}</b></td><td>{p.dept}</td><td><PriorityBadge level={p.priority} /></td>
                          <td className="mono">{waitOf(p, snap.tick)} min</td>
                          <td style={{ textAlign: 'right' }}><button className="btn sm" onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }}>View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </Card>

              <Card title="Department workload" sub="Patients waiting and in treatment per department. The number on the right is patients per doctor.">
                <HBars rows={d.byDept.map((x) => ({
                  label: x.dept, valueText: x.ratio.toFixed(1), tip: `${x.dept}\nWaiting: ${x.waiting}\nIn treatment: ${x.treating}\nDoctors: ${x.doctors} (${x.doctorsFree} free)`,
                  segments: [{ name: 'In treatment', value: x.treating, color: COLORS.blue }, { name: 'Waiting', value: x.waiting, color: COLORS.amber }],
                }))} max={Math.max(4, ...d.byDept.map((x) => x.waiting + x.treating))}
                legend={[{ name: 'In treatment', color: COLORS.blue }, { name: 'Waiting', color: COLORS.amber }]} />
              </Card>

              <Card title="Bed occupancy" sub={`${d.bedsUsed} of ${d.bedsTotal} beds in use. Each square is one bed.`}>
                <HBars rows={Object.entries(d.bedsByType).map(([t, v]) => ({
                  label: resName(t), valueText: `${v.used}/${v.total}`, tip: `${resName(t)} beds\nIn use: ${v.used}\nFree: ${v.total - v.used}`,
                  segments: [{ name: 'In use', value: v.used, color: v.used === v.total && v.total > 0 ? COLORS.red : COLORS.teal }],
                }))} max={Math.max(...Object.values(d.bedsByType).map((v) => v.total), 1)} />
                <div className="bed-grid" style={{ marginTop: 10 }}>
                  {res.beds.map((b) => <span key={b.id} className={`bed ${b.free ? '' : 'used'}`} data-tip={`${resName(b.id)}${b.free ? ' (free)' : ` · ${b.patientId}`}`} tabIndex={0}>{b.type === 'icu' ? 'ICU' : b.type === 'hdu' ? 'HDU' : b.type === 'ward' ? 'W' : 'DC'}</span>)}
                </div>
              </Card>

              <Card title="Recent hospital activity" sub="Patient arrivals, triage, admissions and discharges.">
                <EventFeed events={patientEvents} empty="Start the simulation to see patient activity." />
              </Card>
            </div>

            <div className="stack">
              <Card title="AI decision summary" sub="The latest decision from each algorithm and why it was made.">
                <Decision title="Triage" algo="Prolog rule base" {...(snap.decisions.triage ?? {})} empty="No triage decisions yet." />
                <Decision title="Resource allocation" algo="Prolog allocation rules" {...(snap.decisions.alloc ?? {})} empty="Waiting for the first admission." />
                <Decision title="Emergency routing" algo="A* search" {...(snap.decisions.route ?? {})} empty="Trigger an emergency to compute a route." />
                <Decision title="Patient monitoring" algo="Mamdani fuzzy inference" t={snap.tick}
                  text={critical.length ? `${critical.length} patient${critical.length > 1 ? 's' : ''} at Urgent or Critical monitoring priority` : d.active.length ? 'All monitored patients are Routine or Watch' : ''}
                  why={critical.length ? `Highest: ${[...critical].sort((a, b) => b.vitals.score - a.vitals.score)[0].id} (${[...critical].sort((a, b) => b.vitals.score - a.vitals.score)[0].vitals.score.toFixed(0)}/100)` : 'Heart rate and temperature stay in the normal membership ranges.'} empty="No active patients." />
                <Decision title="Risk estimation" algo="Neuro-fuzzy (ANFIS)" t={snap.tick}
                  text={topRisk ? `Highest risk: ${topRisk.id} at ${topRisk.risk.score}/100` : ''} why={topRisk ? `Category ${topRisk.risk.category}. Based on age, blood pressure, BMI and glucose.` : ''} empty="No active patients." />
              </Card>

              <Card title="Emergency alerts" right={<Link to="/routing" className="btn sm">Routing</Link>}>
                {alerts.length === 0 ? <div className="empty"><b>No active alerts</b>Use “Trigger emergency” to simulate one.</div>
                  : alerts.map((a) => (
                    <div key={a.id} className={`alert-item ${a.level}`}>
                      <Icon name={a.level === 'emergency' ? 'siren' : 'alert'} size={18} />
                      <div><div className="ttl">{a.title} <span className="mono muted">{clockLabel(a.t)}</span></div><div className="txt">{a.text}</div></div>
                    </div>
                  ))}
              </Card>

              <Card title="Resource availability" right={<Link to="/resources" className="btn sm">Manage</Link>}>
                {[['Beds', d.bedsFree, d.bedsTotal], ['Doctors', d.doctorsFree, d.doctorsTotal], ['Diagnostics', res.diags.length - d.diagsBusy, res.diags.length]].map(([n, free, total]) => (
                  <div key={n} style={{ marginBottom: 10 }}>
                    <div className="row spread" style={{ marginBottom: 4 }}><span>{n}</span><b>{free} free <span className="muted">of {total}</span></b></div>
                    <div className="bar"><i style={{ width: `${total ? (100 * (total - free)) / total : 0}%`, background: free === 0 ? COLORS.red : COLORS.teal }} /></div>
                  </div>
                ))}
                <div className="note">Bars show how much is in use.</div>
              </Card>

              <Card title="Recent simulation events" sub="System-level events: start, pause, closures, routing, capacity changes.">
                <EventFeed events={systemEvents} />
              </Card>
            </div>
          </div>
        </>
      )}
      {openId && <PatientDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

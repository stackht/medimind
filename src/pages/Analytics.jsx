import { useSim } from '../context/SimContext.jsx';
import { COLORS, Donut, HBars, KpiCard, PRIORITY_COLOR, SimControls, TimeSeries, VBars } from '../components/dash.jsx';
import { Card } from '../components/ui.jsx';
import { PRIORITIES, PRIORITY_LABEL } from '../lib/simData.js';

export default function Analytics() {
  const { snap, d } = useSim();
  const hist = snap.history;
  const ticks = hist.map((h) => h.t);
  // arrivals per 5 simulated minutes
  const bins = [];
  for (let i = 0; i < hist.length; i += 5) bins.push(hist.slice(i, i + 5).reduce((a, h) => a + h.arrivals, 0));
  const flow = d.discharged.length;

  return (
    <div>
      <div className="page-title-row"><div><h1>Traffic &amp; queue analytics</h1><p>Every chart is drawn from the same simulation state as the rest of the dashboard.</p></div></div>
      <SimControls compact />
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <KpiCard icon="clock" label="Average wait" tip="Mean wait from arrival to admission, including patients still waiting." value={d.avgWait} unit="min" foot={`Longest ${d.maxWait} min`} />
        <KpiCard icon="users" label="Arrivals" value={d.totalArrived} foot={`Arrival rate setting ${snap.settings.arrivalRate.toFixed(2)} per min`} />
        <KpiCard icon="check" tone="ok" label="Discharged" value={flow} foot="Throughput so far" />
        <KpiCard icon="layers" label="In queue now" tone={d.waiting.length > 5 ? 'warn' : ''} value={d.waiting.length} foot={`${d.treating.length} in treatment`} />
      </div>

      <div className="grid g2">
        <Card title="Patients by department" sub="Active patients (waiting plus in treatment).">
          <HBars rows={d.byDept.map((x) => ({ label: x.dept, segments: [{ name: 'In treatment', value: x.treating, color: COLORS.blue }, { name: 'Waiting', value: x.waiting, color: COLORS.amber }] }))}
            max={Math.max(4, ...d.byDept.map((x) => x.waiting + x.treating))} legend={[{ name: 'In treatment', color: COLORS.blue }, { name: 'Waiting', color: COLORS.amber }]} />
        </Card>
        <Card title="Priority distribution" sub="All triaged patients so far, by suggested priority.">
          <Donut data={PRIORITIES.map((p) => ({ name: PRIORITY_LABEL[p], value: d.priorityDist[p], color: PRIORITY_COLOR[p] }))} />
        </Card>
        <Card title="Waiting-time distribution" sub="Minutes from arrival to admission (or so far, if still waiting).">
          <VBars data={d.waitDist.map((b) => ({ name: `${b.name} min`, value: b.count, color: COLORS.teal }))} unit=" patients" />
        </Card>
        <Card title="Arrivals over time" sub="New patients per 5 simulated minutes.">
          {bins.length < 3 ? <div className="empty"><b>Collecting data</b>Press Start. Bars appear as minutes pass.</div> : <VBars data={bins.slice(-12).map((v, i) => ({ name: `#${bins.length - Math.min(12, bins.length) + i + 1}`, value: v, color: COLORS.navy }))} unit=" arrivals" />}
        </Card>
        <Card title="Resource utilization over time" sub="Share of beds and doctors in use.">
          <TimeSeries ticks={ticks} yMax={100} unit="%" series={[{ name: 'Beds in use', color: COLORS.teal, area: true, points: hist.map((h) => h.util) }, { name: 'Doctors busy', color: COLORS.blue, points: hist.map((h) => h.docUtil) }]} />
        </Card>
        <Card title="Queue length over time" sub="Patients waiting versus in treatment.">
          <TimeSeries ticks={ticks} series={[{ name: 'Waiting', color: COLORS.amber, area: true, points: hist.map((h) => h.waiting) }, { name: 'In treatment', color: COLORS.navy, points: hist.map((h) => h.treating) }]} />
        </Card>
      </div>
    </div>
  );
}

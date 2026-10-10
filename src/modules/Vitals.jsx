import { useMemo } from 'react';
import { usePatient } from '../context/PatientContext.jsx';
import { human, infer, VITALS_SYSTEM } from '../lib/fuzzy.js';
import { Badge, Card, Explain, PageHeader, Slider, Stat } from '../components/ui.jsx';
import { MembershipChart } from '../components/charts.jsx';

export default function Vitals() {
  const { patient, update } = usePatient();
  const out = useMemo(() => infer(VITALS_SYSTEM, { heartRate: patient.heartRate, temp: patient.temp }), [patient.heartRate, patient.temp]);
  const [hr, tp] = VITALS_SYSTEM.inputs;
  const active = out.fired.filter((f) => f.strength > 0.001).sort((a, b) => b.strength - a.strength);

  return (
    <div className="stack">
      <PageHeader title="Vitals Monitor with Fuzzy Logic"
        desc="A heart rate of 101 bpm is not suddenly “abnormal”. Fuzzy membership functions let a measurement belong partly to several categories, and fuzzy rules combine them into a smooth monitoring priority."
        tags={['Fuzzy logic', 'Membership functions', 'Mamdani inference', 'Centroid defuzzification']} />

      <div className="grid g-side">
        <div className="stack">
          <Card title="Simulated measurements">
            <Slider label="Heart rate" unit="bpm" min={30} max={200} value={patient.heartRate} onChange={(heartRate) => update({ heartRate })} />
            <Slider label="Body temperature" unit="°C" min={34} max={42} step={0.1} value={patient.temp} onChange={(temp) => update({ temp })} />
            <div className="grid g2">
              <Stat k="Monitoring priority" v={out.crisp.toFixed(1)} s="out of 100" />
              <div className="stat"><div className="k">Category</div><div style={{ marginTop: 6 }}><Badge level={out.label}><span style={{ fontSize: 16 }}>{out.label}</span></Badge></div></div>
            </div>
          </Card>
          <Card title="Degrees of membership" sub="Step 1 · Fuzzification">
            <table className="tbl"><tbody>
              {[hr, tp].map((v) => (
                <tr key={v.name}><td><b>{v.label}</b></td><td>{Object.entries(out.fuzzified[v.name]).filter(([, m]) => m > 0.001).map(([k, m]) => <div key={k}>{human(k)}: <b>{m.toFixed(2)}</b></div>)}</td></tr>
              ))}
            </tbody></table>
          </Card>
        </div>

        <div className="stack">
          <div className="grid g2">
            <Card><MembershipChart variable={hr} value={patient.heartRate} title={`${hr.label} (${hr.unit})`} /></Card>
            <Card><MembershipChart variable={tp} value={patient.temp} title={`${tp.label} (${tp.unit})`} /></Card>
          </div>
          <Card title="Aggregated output & defuzzification" sub="Step 3 · Clipped rule outputs are merged with MAX; the centroid gives the crisp priority.">
            <MembershipChart variable={VITALS_SYSTEM.output} curve={out.curve} crisp={out.crisp} height={170} />
          </Card>
        </div>
      </div>

      <Card title="Fuzzy rules firing" sub={`Step 2 · ${active.length} of ${out.fired.length} rules have non-zero strength (AND = min).`}>
        <div className="scroll"><table className="tbl">
          <thead><tr><th>Rule</th><th>Strength</th><th style={{ width: '30%' }} /></tr></thead>
          <tbody>
            {active.map((f) => (
              <tr key={f.i}>
                <td>IF heart rate is <b>{human(f.rule.if.heartRate)}</b> AND temperature is <b>{human(f.rule.if.temp)}</b> THEN priority is <Badge level={f.rule.then} /></td>
                <td className="mono">{f.strength.toFixed(2)}</td>
                <td><div className="bar"><i style={{ width: `${f.strength * 100}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div style={{ marginTop: 12 }}><Explain>Each rule’s strength is the weaker (min) of its two input memberships. That strength clips the output set, and all clipped shapes are united. The centre of mass of that region is the final score, so the result is smooth rather than a hard threshold.</Explain></div>
      </Card>
    </div>
  );
}

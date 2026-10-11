// Problem identification and formulation for the intelligent patient triage and monitoring agent (PEAS model).
export const PROBLEM_STATEMENT = 'Healthcare facilities need to efficiently monitor patient vitals and assign triage priority to reduce wait times. '
  + 'The problem is to build an intelligent patient monitoring agent that perceives symptoms and vital signs and decides priorities, alerts and resource use.';

export const PEAS = {
  agent: 'Intelligent patient triage and monitoring agent',
  performance: [
    'Share of patients assessed within their triage target (Emergency and High 10 min, Moderate 60 min, Routine 120 min)',
    'Mean waiting time of urgent (Emergency and High) patients',
    'Urgency-weighted waiting cost summed over all patients',
    'Bed and doctor utilisation: neither idle nor overloaded',
    'Every priority decision comes with a stated reason (explainability)',
  ],
  environment: [
    'Emergency department, wards and corridors of a two-floor hospital',
    'Arriving patients with symptoms, pain and changing vital signs',
    'Beds, specialist doctors and diagnostic units with limited availability',
    'Simulated clock, closed corridors and other staff',
  ],
  actuators: [
    'Assign triage priority (Routine, Moderate, High, Emergency)',
    'Raise emergency and long-wait alerts on the dashboard',
    'Allocate a bed, a specialist and a diagnostic unit',
    'Escalate or discharge a patient',
    'Plan a transfer route (A*) and recommend an assessment time',
  ],
  sensors: [
    'Patient-reported symptoms and pain score',
    'Heart rate and body temperature (monitor)',
    'Age, blood pressure, BMI and glucose',
    'Bed, doctor and scanner availability, queue length',
    'Simulated clock and corridor status',
  ],
};

export const ENV_PROPERTIES = [
  ['Observability', 'Partially observable', 'The true condition is hidden; only reported symptoms and measured vitals are sensed.'],
  ['Determinism', 'Stochastic', 'Arrivals, symptoms and vital-sign drift are random; the next state is not fully predicted by the current one.'],
  ['Episodes', 'Sequential', 'Giving a bed to one patient changes what is available for every later patient.'],
  ['Change over time', 'Dynamic', 'New patients arrive and vitals drift while the agent is deciding.'],
  ['State and time', 'Hybrid (discrete and continuous)', 'Symptoms and priorities are discrete; vital signs, time and cost are continuous.'],
  ['Agents', 'Multi-agent (cooperative)', 'Doctors, nurses and other patients also act in the same environment.'],
  ['Knowledge', 'Partly known', 'The triage rules are known; patient arrivals and outcomes must be handled as uncertain.'],
];

export const AGENT_TYPE = 'Utility-based agent with a model of the hospital: percepts are interpreted by a Prolog rule base (priority), a fuzzy system (monitoring) and a neuro-fuzzy model (risk), and the chosen action maximises the urgency-weighted performance measure.';

export const FORMULATION = [
  ['States', 'The set of patients (priority, status, vital signs), the availability of every bed, doctor and diagnostic unit, and the simulated clock.'],
  ['Initial state', 'The seeded starting hospital: seven synthetic patients and all resources free at 08:00.'],
  ['Actions', 'ASSIGN-PRIORITY(p), ADMIT(p, bed, doctor, diagnostic), ESCALATE(p), DISCHARGE(p), ROUTE(p, start, goal), WAIT.'],
  ['Transition model', 'Apply the action, then advance one minute: random arrivals, vital-sign drift, completed treatments release resources.'],
  ['Goal test', 'Every patient is assessed within the triage target for its priority and no Emergency patient is left without a route. This is a continuing task, so it is judged by the performance measure.'],
  ['Path cost', 'Urgency-weighted waiting minutes: Emergency x8, High x4, Moderate x2, Routine x1 (lower is better).'],
];

// triage targets in minutes and urgency weights per priority class
export const TARGET_MIN = { emergency: 10, high: 10, moderate: 60, routine: 120 };
export const WEIGHT = { emergency: 8, high: 4, moderate: 2, routine: 1 };

// Live performance measures computed from the shared simulation snapshot.
export function performanceMeasures(snap) {
  const classes = ['emergency', 'high', 'moderate', 'routine'];
  const rows = Object.fromEntries(classes.map((c) => [c, { n: 0, within: 0, waitSum: 0, cost: 0 }]));
  for (const p of snap.patients) {
    if (p.status === 'triage') continue;
    const waited = p.status === 'waiting' ? Math.max(0, snap.tick - p.arrivalTick) : p.waited;
    if (waited == null) continue;
    const r = rows[p.priority];
    r.n++; r.waitSum += waited; r.cost += waited * WEIGHT[p.priority];
    if (waited <= TARGET_MIN[p.priority]) r.within++;
  }
  const all = classes.reduce((a, c) => ({ n: a.n + rows[c].n, within: a.within + rows[c].within, waitSum: a.waitSum + rows[c].waitSum, cost: a.cost + rows[c].cost }), { n: 0, within: 0, waitSum: 0, cost: 0 });
  const urgent = { n: rows.emergency.n + rows.high.n, waitSum: rows.emergency.waitSum + rows.high.waitSum };
  const decided = snap.patients.filter((p) => p.status !== 'triage');
  const bedsTotal = snap.resources.beds.length;
  return {
    byClass: Object.fromEntries(classes.map((c) => [c, { ...rows[c], pct: rows[c].n ? (100 * rows[c].within) / rows[c].n : null, avg: rows[c].n ? rows[c].waitSum / rows[c].n : null }])),
    withinPct: all.n ? (100 * all.within) / all.n : null,
    urgentAvg: urgent.n ? urgent.waitSum / urgent.n : null,
    weightedCost: all.cost,
    bedUtil: bedsTotal ? (100 * snap.resources.beds.filter((b) => !b.free).length) / bedsTotal : 0,
    docUtil: snap.resources.doctors.length ? (100 * snap.resources.doctors.filter((d) => !d.free).length) / snap.resources.doctors.length : 0,
    explainedPct: decided.length ? (100 * decided.filter((p) => p.prolog?.reasons?.length).length) / decided.length : null,
    patients: all.n,
  };
}

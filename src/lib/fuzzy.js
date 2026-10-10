// Mamdani fuzzy inference: fuzzification -> rule firing (min) -> aggregation (max) -> centroid.
export const mf = (s, x) => {
  const [a, b, c, d] = s.p;
  if (s.type === 'gauss') return Math.exp(-((x - a) ** 2) / (2 * b * b)); // centre a, width b
  if (s.type === 'tri') {
    if (x < a || x > c) return 0;
    if (x === b) return 1;
    return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
  }
  // trapezoid (a,b,c,d); shoulders allowed when a===b or c===d
  if (x < a || x > d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
};
const tri = (a, b, c) => ({ type: 'tri', p: [a, b, c] });
const trap = (a, b, c, d) => ({ type: 'trap', p: [a, b, c, d] });

export function infer(system, inputs, samples = 201) {
  const fuzzified = {};
  for (const v of system.inputs) {
    fuzzified[v.name] = Object.fromEntries(Object.entries(v.sets).map(([k, s]) => [k, mf(s, inputs[v.name])]));
  }
  const fired = system.rules.map((r, i) => {
    const strength = Math.min(...Object.entries(r.if).map(([v, set]) => fuzzified[v][set]));
    return { i, rule: r, strength };
  });
  const [lo, hi] = system.output.range;
  const curve = [];
  let num = 0, den = 0;
  for (let k = 0; k < samples; k++) {
    const x = lo + ((hi - lo) * k) / (samples - 1);
    let y = 0;
    for (const f of fired) y = Math.max(y, Math.min(f.strength, mf(system.output.sets[f.rule.then], x)));
    curve.push({ x, y });
    num += x * y; den += y;
  }
  const crisp = den > 0 ? num / den : (lo + hi) / 2;
  const memberships = Object.fromEntries(Object.entries(system.output.sets).map(([k, s]) => [k, mf(s, crisp)]));
  const label = Object.entries(memberships).sort((a, b) => b[1] - a[1])[0][0];
  return { fuzzified, fired, curve, crisp, label };
}

// ---------- PS6: vital-sign monitoring ----------
const L = ['low', 'normal', 'elevated', 'veryHigh'];
const T = ['low', 'normal', 'fever', 'high'];
const MATRIX = [
  ['urgent', 'watch', 'urgent', 'critical'],
  ['watch', 'routine', 'watch', 'urgent'],
  ['urgent', 'watch', 'urgent', 'critical'],
  ['critical', 'urgent', 'critical', 'critical'],
];
export const VITALS_SYSTEM = {
  inputs: [
    { name: 'heartRate', label: 'Heart rate', unit: 'bpm', range: [30, 200], sets: {
      low: trap(30, 30, 45, 60), normal: trap(55, 65, 85, 100), elevated: tri(90, 110, 130), veryHigh: trap(120, 145, 200, 200) } },
    { name: 'temp', label: 'Body temperature', unit: '°C', range: [34, 42], sets: {
      low: trap(34, 34, 35, 36.2), normal: trap(35.8, 36.4, 37.2, 37.8), fever: tri(37.4, 38.3, 39.2), high: trap(38.8, 39.8, 42, 42) } },
  ],
  output: { name: 'priority', label: 'Monitoring priority', unit: '/100', range: [0, 100], sets: {
    routine: trap(0, 0, 15, 30), watch: tri(20, 38, 55), urgent: tri(45, 62, 80), critical: trap(70, 85, 100, 100) } },
  rules: L.flatMap((h, i) => T.map((t, j) => ({ if: { heartRate: h, temp: t }, then: MATRIX[i][j] }))),
};

// ---------- PS7: room lighting control ----------
const ACT = ['rest', 'care', 'procedure'];
const AMB = ['dark', 'dim', 'bright'];
const OCC = ['empty', 'few', 'crowded'];
const LEVELS = ['off', 'low', 'medium', 'high', 'max'];
const baseLevel = { rest: 1, care: 2, procedure: 3 };
const ambAdj = { dark: 1, dim: 0, bright: -1 };
export const ROOM_SYSTEM = {
  inputs: [
    { name: 'ambient', label: 'Ambient light', unit: 'lux', range: [0, 1000], sets: {
      dark: trap(0, 0, 50, 150), dim: tri(100, 300, 500), bright: trap(400, 650, 1000, 1000) } },
    { name: 'occupancy', label: 'Room occupancy', unit: 'people', range: [0, 6], sets: {
      empty: trap(0, 0, 0.4, 1), few: tri(0.5, 2, 3.5), crowded: trap(3, 4.5, 6, 6) } },
    { name: 'activity', label: 'Activity level', unit: '/10', range: [0, 10], sets: {
      rest: trap(0, 0, 2, 4), care: tri(3, 5, 7), procedure: trap(6, 8, 10, 10) } },
  ],
  output: { name: 'intensity', label: 'Lighting intensity', unit: '%', range: [0, 100], sets: {
    off: trap(0, 0, 5, 15), low: tri(10, 25, 40), medium: tri(30, 50, 70), high: tri(60, 75, 90), max: trap(80, 92, 100, 100) } },
  rules: AMB.flatMap((a) => OCC.flatMap((o) => ACT.map((c) => {
    let lvl;
    if (o === 'empty') lvl = c === 'procedure' ? 1 : 0;
    else lvl = Math.max(0, Math.min(4, baseLevel[c] + ambAdj[a] + (o === 'crowded' && c !== 'rest' ? 1 : 0)));
    return { if: { ambient: a, occupancy: o, activity: c }, then: LEVELS[lvl] };
  }))),
};

// camelCase set names -> readable text ("veryHigh" -> "very high")
export const human = (s) => s.replace(/([A-Z])/g, ' $1').toLowerCase();

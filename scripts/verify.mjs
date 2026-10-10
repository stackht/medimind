// Automated verification suite for MediMind's algorithms and simulation.
// Run with: npm run verify   (plain Node, no test framework needed)
import { buildAdjacency, NODES, EDGES, heuristic } from '../src/lib/graph.js';
import { bfs, dfs, astar } from '../src/lib/search.js';
import { classifyPatient, allocateOne, allocateAll } from '../src/lib/prolog.js';
import { infer, VITALS_SYSTEM, ROOM_SYSTEM } from '../src/lib/fuzzy.js';
import { Anfis, genRiskData, splitData, mulberry32 } from '../src/lib/anfis.js';
import { solve, naiveValue, DEFAULT_ASSETS, DEFAULT_PARAMS } from '../src/lib/minimax.js';
import { genPerceptronData, trainPerceptron, genClusterData, trainCompetitive, purity } from '../src/lib/learn.js';
import { train as trainLm, predict, generate, DEFAULT_CORPUS, END } from '../src/lib/ngram.js';
import { Simulation } from '../src/lib/sim.js';
import { toPriority } from '../src/lib/simData.js';

const results = [];
const test = async (id, name, fn) => {
  try { const ok = await fn(); results.push({ id, name, pass: ok !== false }); }
  catch (e) { results.push({ id, name, pass: false, error: String(e.message ?? e) }); }
};
const ids = NODES.map((n) => n.id);
const open = buildAdjacency();
const pairs = ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => [a, b]));
const waitReady = async (sim) => { while (!sim.getSnapshot().ready) await new Promise((r) => setTimeout(r, 20)); };
const patient = (o) => ({ age: 35, pain: 2, temp: 36.8, symptoms: [], ...o });

// ---------------- search ----------------
await test('TC-01', 'BFS finds a route between every pair of locations', () => pairs.every(([a, b]) => bfs(open, a, b).found));
await test('TC-02', 'DFS finds a route between every pair of locations', () => pairs.every(([a, b]) => dfs(open, a, b).found));
await test('TC-03', 'BFS never uses more hops than DFS', () => pairs.every(([a, b]) => bfs(open, a, b).path.length <= dfs(open, a, b).path.length));
await test('TC-04', 'A* cost equals uniform-cost optimum for every pair', () => pairs.every(([a, b]) => astar(open, a, b, true).cost === astar(open, a, b, false).cost));
await test('TC-05', 'A* cost is never higher than BFS path cost', () => pairs.every(([a, b]) => astar(open, a, b).cost <= bfs(open, a, b).cost));
await test('TC-06', 'A* expands no more nodes than uniform-cost on average', () => {
  const sum = (h) => pairs.reduce((s, [a, b]) => s + astar(open, a, b, h).expanded, 0);
  return sum(true) <= sum(false);
});
await test('TC-07', 'Heuristic is admissible (never above true cost)', () => pairs.every(([a, b]) => heuristic(a, b) <= astar(open, a, b, false).cost));
await test('TC-08', 'Closing both lift and stairs disconnects the floors', () => {
  const adj = buildAdjacency({ blockedTypes: new Set(['lift', 'stairs']) });
  return !astar(adj, 'ambulance', 'icu').found;
});
await test('TC-09', 'Closing a corridor on the best route never lowers the cost', () => {
  const best = astar(open, 'ambulance', 'icu');
  const e = EDGES.find((x) => x.key === [best.path[1], best.path[2]].sort().join('|'));
  const adj = buildAdjacency({ blockedEdges: new Set([e.key]) });
  const alt = astar(adj, 'ambulance', 'icu');
  return alt.found && alt.cost >= best.cost && !alt.path.join().includes(`${best.path[1]},${best.path[2]}`);
});
await test('TC-10', 'Stretcher mode (no stairs) never uses a staircase', () => {
  const adj = buildAdjacency({ blockedTypes: new Set(['stairs']) });
  const r = astar(adj, 'ambulance', 'cardio');
  return r.found && !r.path.includes('stairs0') && !r.path.includes('stairs1');
});

// ---------------- Prolog triage ----------------
const level = async (p) => toPriority(await classifyPatient(p));
await test('TC-11', 'Prolog: chest pain is classified Emergency', async () => (await level(patient({ symptoms: ['chest_pain'] }))) === 'emergency');
await test('TC-12', 'Prolog: mild cold is classified Routine', async () => (await level(patient({ symptoms: ['cough', 'runny_nose'] }))) === 'routine');
await test('TC-13', 'Prolog: elderly patient with dizziness is High', async () => (await level(patient({ age: 72, symptoms: ['dizziness'] }))) === 'high');
await test('TC-14', 'Prolog: moderate symptom in an adult is Moderate', async () => (await level(patient({ symptoms: ['abdominal_pain'] }))) === 'moderate');
await test('TC-15', 'Prolog: extreme pain alone is High', async () => (await level(patient({ pain: 9, symptoms: ['fatigue'] }))) === 'high');
await test('TC-16', 'Prolog: every classification returns at least one reason', async () => (await classifyPatient(patient({ symptoms: ['rash'] }))).reasons.length > 0);

// ---------------- Prolog allocation ----------------
const res = (bedFree) => ({
  beds: [{ id: 'icu_1', type: 'icu', free: bedFree.icu }, { id: 'hdu_1', type: 'hdu', free: true }, { id: 'ward_1', type: 'ward', free: true }, { id: 'day_1', type: 'day_care', free: true }],
  doctors: [{ id: 'dr_c', specialty: 'cardiology', free: true }, { id: 'dr_g', specialty: 'general_medicine', free: true }],
  diags: [{ id: 'lab_1', type: 'lab', free: false }],
});
await test('TC-17', 'Allocation: high priority gets an ICU bed when free', async () => (await allocateOne(res({ icu: true }), { priority: 'high', condition: 'cardiac', diag: 'none' })).bed === 'icu_1');
await test('TC-18', 'Allocation: fallback steps down from ICU to HDU when ICU is full', async () => (await allocateOne(res({ icu: false }), { priority: 'high', condition: 'cardiac', diag: 'none' })).bed === 'hdu_1');
await test('TC-19', 'Allocation: specialist is matched to the condition', async () => (await allocateOne(res({ icu: true }), { priority: 'high', condition: 'cardiac', diag: 'none' })).doctor === 'dr_c');
await test('TC-20', 'Allocation: busy diagnostic unit returns "queued"', async () => (await allocateOne(res({ icu: true }), { priority: 'high', condition: 'cardiac', diag: 'lab' })).diag === 'queued');
await test('TC-21', 'Allocation: urgent patient is served before routine patient', async () => {
  const r = await allocateAll(res({ icu: true }), [{ id: 1, priority: 'low', condition: 'general', diag: 'none' }, { id: 2, priority: 'high', condition: 'cardiac', diag: 'none' }]);
  return r[0].patient.id === 2;
});

// ---------------- fuzzy ----------------
await test('TC-22', 'Fuzzy vitals: critical vitals score higher than normal vitals', () => infer(VITALS_SYSTEM, { heartRate: 150, temp: 40 }).crisp > infer(VITALS_SYSTEM, { heartRate: 72, temp: 36.8 }).crisp + 40);
await test('TC-23', 'Fuzzy vitals: output stays within 0 to 100', () => {
  for (let h = 30; h <= 200; h += 17) for (let t = 34; t <= 42; t += 0.7) { const c = infer(VITALS_SYSTEM, { heartRate: h, temp: t }).crisp; if (c < 0 || c > 100) return false; }
  return true;
});
await test('TC-24', 'Fuzzy room: empty resting room is switched off', () => infer(ROOM_SYSTEM, { ambient: 20, occupancy: 0, activity: 0 }).crisp < 15);
await test('TC-25', 'Fuzzy room: crowded procedure in the dark is near maximum', () => infer(ROOM_SYSTEM, { ambient: 20, occupancy: 5, activity: 9 }).crisp > 80);

// ---------------- neuro-fuzzy ----------------
await test('TC-26', 'Neuro-fuzzy: training reduces test RMSE by more than 70%', () => {
  const { train: tr, test: te } = splitData(genRiskData());
  const m = new Anfis(); const r = mulberry32(5); const before = m.rmse(te.X, te.y);
  for (let e = 0; e < 60; e++) m.epoch(tr.X, tr.y, r);
  return m.rmse(te.X, te.y) < before * 0.3;
});
await test('TC-27', 'Neuro-fuzzy: predictions are bounded in [0, 1]', () => {
  const m = new Anfis();
  return [[0, 0, 0, 0], [1, 1, 1, 1], [0.5, 0.2, 0.9, 0.4]].every((x) => { const y = m.predict(x); return y >= 0 && y <= 1; });
});

// ---------------- minimax ----------------
await test('TC-28', 'Minimax: alpha-beta returns the same value as plain minimax', () => solve(DEFAULT_ASSETS, DEFAULT_PARAMS, true).value === solve(DEFAULT_ASSETS, DEFAULT_PARAMS, false).value);
await test('TC-29', 'Minimax: alpha-beta searches fewer nodes', () => solve(DEFAULT_ASSETS, DEFAULT_PARAMS, true).nodes < solve(DEFAULT_ASSETS, DEFAULT_PARAMS, false).nodes);
await test('TC-30', 'Minimax: optimal defence beats an undefended system', () => solve(DEFAULT_ASSETS, DEFAULT_PARAMS, true).value > naiveValue(DEFAULT_ASSETS, DEFAULT_PARAMS));

// ---------------- perceptron / competitive ----------------
await test('TC-31', 'Perceptron: reaches zero errors on well-separated classes', () => trainPerceptron(genPerceptronData(70, 3, 0.8), { eta: 0.05, epochs: 60 }).at(-1).errors === 0);
await test('TC-32', 'Competitive learning: recovers hidden groups (purity at least 90%)', () => { const d = genClusterData(); return purity(d, trainCompetitive(d).at(-1).assign) >= 0.9; });

// ---------------- language models ----------------
const lm = trainLm(DEFAULT_CORPUS);
await test('TC-33', 'N-gram: next-word probabilities sum to 1 (bigram and trigram)', () => ['please', 'your', 'regular'].every((w) => Math.abs(predict(lm, [w], 'bigram').dist.reduce((s, d) => s + d.p, 0) - 1) < 1e-9)
  && Math.abs(predict(lm, ['please', 'bring'], 'trigram').dist.reduce((s, d) => s + d.p, 0) - 1) < 1e-9);
await test('TC-34', 'N-gram: generated words all come from the training vocabulary', () => {
  const r = mulberry32(3);
  return ['bigram', 'trigram'].every((m) => generate(lm, 'your', m, { rnd: r }).trace.every((t) => t.word === END || lm.vocab.includes(t.word)));
});

// ---------------- simulation ----------------
const runSim = async (ticks) => {
  const s = new Simulation(); await waitReady(s);
  for (let i = 0; i < ticks; i++) await s.step();
  return s;
};
const sigOf = (s) => s.getSnapshot().patients.map((p) => `${p.id}:${p.priority}:${p.status}`).join('|');
await test('TC-35', 'Simulation: same seed reproduces identical patients', async () => { const a = await runSim(40); const b = await runSim(40); return sigOf(a) === sigOf(b); });
await test('TC-36', 'Simulation: no bed is shared and every treated patient has a doctor', async () => {
  const d = (await runSim(120)).getSnapshot(); const t = d.d.treating;
  return new Set(t.map((p) => p.bedId)).size === t.length && t.every((p) => p.doctorId) && d.resources.beds.filter((b) => !b.free).length === t.length;
});
await test('TC-37', 'Simulation: every arrived patient is accounted for', async () => {
  const d = (await runSim(120)).getSnapshot();
  return d.patients.length === d.patients.filter((p) => ['triage', 'waiting', 'treating', 'discharged'].includes(p.status)).length;
});
await test('TC-38', 'Simulation: emergency trigger raises an alert and an A* route', async () => {
  const s = new Simulation(); await waitReady(s);
  const n = s.getSnapshot().alerts.length; await s.triggerEmergency();
  const d = s.getSnapshot();
  return d.alerts.length > n && d.lastRoute?.found && d.lastRoute.algo === 'A*';
});
await test('TC-39', 'Simulation: capacity cannot drop below beds in use', async () => {
  const s = await runSim(60); const used = s.getSnapshot().d.bedsByType.ward.used;
  const r = s.setCapacity('beds', 'ward', Math.max(0, used - 1));
  return used === 0 ? r.ok : !r.ok;
});
await test('TC-40', 'Simulation: reset returns to the seeded starting state', async () => {
  const s = await runSim(30); s.reset(); await waitReady(s);
  const d = s.getSnapshot(); return d.tick === 0 && d.patients.length === 7;
});

await test('TC-41', 'Simulation: arrivals are identical under both queue policies', async () => {
  const run = async (policy) => { const s = new Simulation(); s.settings.queuePolicy = policy; await waitReady(s); for (let i = 0; i < 80; i++) await s.step(); return s.getSnapshot().patients.map((p) => `${p.id}@${p.arrivalTick}:${p.condition}:${p.age}`).join('|'); };
  return (await run('priority')) === (await run('fcfs'));
});
await test('TC-42', 'Simulation: priority triage serves emergencies no later than first-come-first-served', async () => {
  const mean = async (policy) => {
    const s = new Simulation(); s.settings.queuePolicy = policy; await waitReady(s); for (let i = 0; i < 200; i++) await s.step();
    const w = s.getSnapshot().patients.filter((p) => (p.priority === 'emergency' || p.priority === 'high') && (p.waited != null)).map((p) => p.waited);
    return w.reduce((a, b) => a + b, 0) / Math.max(1, w.length);
  };
  return (await mean('priority')) <= (await mean('fcfs'));
});

const passed = results.filter((r) => r.pass).length;
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}${r.error ? `  [${r.error}]` : ''}`);
console.log(`\n${passed} / ${results.length} tests passed`);
if (process.argv[2]) (await import('node:fs')).writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
process.exit(passed === results.length ? 0 : 1);

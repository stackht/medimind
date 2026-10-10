// Collects the measured results quoted in the project report. Usage: node scripts/report-metrics.mjs out.json
import { writeFileSync } from 'node:fs';
import { buildAdjacency, NODE_BY_ID } from '../src/lib/graph.js';
import { bfs, dfs, astar } from '../src/lib/search.js';
import { classifyPatient } from '../src/lib/prolog.js';
import { infer, VITALS_SYSTEM, ROOM_SYSTEM } from '../src/lib/fuzzy.js';
import { Anfis, genRiskData, splitData, mulberry32, riskCategory } from '../src/lib/anfis.js';
import { solve, naiveValue, DEFAULT_ASSETS, DEFAULT_PARAMS } from '../src/lib/minimax.js';
import { genPerceptronData, trainPerceptron, genClusterData, trainCompetitive, purity } from '../src/lib/learn.js';
import { train as trainLm, predict, generate, DEFAULT_CORPUS, tokenizeSentences } from '../src/lib/ngram.js';
import { Simulation } from '../src/lib/sim.js';
import { toPriority } from '../src/lib/simData.js';

const out = {};

// ---- 1. search comparison on representative requests ----
const adj = buildAdjacency();
const adjStretcher = buildAdjacency({ blockedTypes: new Set(['stairs']) });
const reqs = [['entrance', 'cardio'], ['entrance', 'ot'], ['reception', 'peds'], ['ambulance', 'icu'], ['ambulance', 'ot']];
out.search = reqs.map(([a, b]) => {
  const r = { bfs: bfs(adj, a, b), dfs: dfs(adj, a, b), astar: astar(adjStretcher, a, b, true), ucs: astar(adjStretcher, a, b, false) };
  const pick = (x) => ({ hops: x.path.length - 1, cost: x.cost, expanded: x.expanded, path: x.path.map((n) => NODE_BY_ID[n].name) });
  return { from: NODE_BY_ID[a].name, to: NODE_BY_ID[b].name, bfs: pick(r.bfs), dfs: pick(r.dfs), astar: pick(r.astar), ucs: pick(r.ucs) };
});
const allIds = Object.keys(NODE_BY_ID);
const pairs = allIds.flatMap((a) => allIds.filter((b) => b !== a).map((b) => [a, b]));
out.searchAll = {
  pairs: pairs.length,
  bfsHopsAvg: pairs.reduce((s, [a, b]) => s + bfs(adj, a, b).path.length - 1, 0) / pairs.length,
  dfsHopsAvg: pairs.reduce((s, [a, b]) => s + dfs(adj, a, b).path.length - 1, 0) / pairs.length,
  bfsCostAvg: pairs.reduce((s, [a, b]) => s + bfs(adj, a, b).cost, 0) / pairs.length,
  dfsCostAvg: pairs.reduce((s, [a, b]) => s + dfs(adj, a, b).cost, 0) / pairs.length,
  astarExpAvg: pairs.reduce((s, [a, b]) => s + astar(adj, a, b, true).expanded, 0) / pairs.length,
  ucsExpAvg: pairs.reduce((s, [a, b]) => s + astar(adj, a, b, false).expanded, 0) / pairs.length,
  astarCostAvg: pairs.reduce((s, [a, b]) => s + astar(adj, a, b, true).cost, 0) / pairs.length,
};

// ---- 2. triage rule verification on 24 hand-labelled cases (labels written from the triage policy, not from rule output) ----
const P = (age, pain, temp, symptoms, expected) => ({ age, pain, temp, symptoms, expected });
const cases = [
  P(28, 2, 36.8, ['runny_nose'], 'routine'), P(35, 3, 37.0, ['sore_throat', 'cough'], 'routine'), P(22, 1, 36.6, ['rash'], 'routine'),
  P(41, 4, 37.2, ['headache'], 'routine'), P(50, 2, 36.9, ['fatigue'], 'routine'), P(30, 3, 37.4, ['cough'], 'routine'),
  P(30, 4, 39.0, ['high_fever'], 'moderate'), P(45, 7, 37.0, ['abdominal_pain'], 'moderate'), P(70, 3, 36.8, ['cough'], 'moderate'),
  P(25, 5, 36.9, ['persistent_vomiting', 'dehydration'], 'moderate'), P(4, 2, 38.0, ['cough'], 'moderate'), P(38, 6, 37.1, ['suspected_fracture'], 'moderate'),
  P(72, 5, 38.6, ['dizziness'], 'high'), P(3, 4, 39.2, ['high_fever'], 'high'), P(40, 9, 37.0, ['abdominal_pain'], 'high'),
  P(33, 5, 40.5, ['fatigue'], 'high'), P(68, 4, 37.2, ['dehydration'], 'high'), P(2, 3, 38.0, ['persistent_vomiting'], 'high'),
  P(58, 7, 37.0, ['chest_pain'], 'emergency'), P(64, 5, 37.3, ['breathing_difficulty'], 'emergency'), P(30, 8, 36.8, ['severe_bleeding', 'suspected_fracture'], 'emergency'),
  P(19, 4, 37.0, ['seizure'], 'emergency'), P(70, 5, 37.0, ['stroke_signs', 'dizziness'], 'emergency'), P(45, 3, 36.5, ['unconscious'], 'emergency'),
];
const classes = ['routine', 'moderate', 'high', 'emergency'];
const matrix = Object.fromEntries(classes.map((a) => [a, Object.fromEntries(classes.map((b) => [b, 0]))]));
const wrong = [];
for (const c of cases) {
  const got = toPriority(await classifyPatient({ ...c, name: 'x' }));
  matrix[c.expected][got]++;
  if (got !== c.expected) wrong.push({ ...c, got });
}
out.triage = { total: cases.length, correct: cases.length - wrong.length, matrix, wrong };

// ---- 3. fuzzy samples ----
out.fuzzyVitals = [[72, 36.8], [100, 37.6], [128, 37.1], [130, 39.0], [150, 40.0], [45, 35.0]].map(([h, t]) => {
  const r = infer(VITALS_SYSTEM, { heartRate: h, temp: t }); return { hr: h, temp: t, score: +r.crisp.toFixed(1), label: r.label };
});
out.fuzzyRoom = [[15, 1, 1], [420, 4, 5], [850, 3, 2], [30, 5, 9], [200, 0, 0]].map(([a, o, c]) => {
  const r = infer(ROOM_SYSTEM, { ambient: a, occupancy: o, activity: c }); return { ambient: a, occupancy: o, activity: c, intensity: +r.crisp.toFixed(1), label: r.label };
});

// ---- 4. neuro-fuzzy training ----
{
  const { train: tr, test: te } = splitData(genRiskData());
  const m = new Anfis(); const r = mulberry32(5);
  const log = { epochs: [], trainRmse: [], testRmse: [] };
  const rec = (e) => { log.epochs.push(e); log.trainRmse.push(+m.rmse(tr.X, tr.y).toFixed(5)); log.testRmse.push(+m.rmse(te.X, te.y).toFixed(5)); };
  rec(0);
  for (let e = 1; e <= 100; e++) { m.epoch(tr.X, tr.y, r); if ([1, 5, 10, 20, 40, 60, 100].includes(e)) rec(e); }
  const pred = te.X.map((x) => m.predict(x));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const mp = mean(pred), mt = mean(te.y);
  const corr = pred.reduce((s, p, i) => s + (p - mp) * (te.y[i] - mt), 0) / Math.sqrt(pred.reduce((s, p) => s + (p - mp) ** 2, 0) * te.y.reduce((s, y) => s + (y - mt) ** 2, 0));
  const cat = (v) => riskCategory(v * 100);
  const acc = pred.filter((p, i) => cat(p) === cat(te.y[i])).length / pred.length;
  const mae = mean(pred.map((p, i) => Math.abs(p - te.y[i])));
  out.anfis = { ...log, nTrain: tr.X.length, nTest: te.X.length, rules: m.nRules, corr, categoryAccuracy: acc, maeTest: mae };
}

// ---- 5. perceptron and competitive learning ----
{
  const d = genPerceptronData(70, 3, 1.45); const h = trainPerceptron(d, { eta: 0.05, epochs: 40 });
  const easy = trainPerceptron(genPerceptronData(70, 3, 0.8), { eta: 0.05, epochs: 60 });
  out.perceptron = {
    n: d.length, epochsRun: h.length - 1, errorsStart: h[0].errors, errorsFinal: h.at(-1).errors, accFinal: 1 - h.at(-1).errors / d.length,
    bestErrors: Math.min(...h.map((x) => x.errors)), easyEpochs: easy.length - 1, easyErrors: easy.at(-1).errors,
  };
  const c = genClusterData(); const ch = trainCompetitive(c);
  out.competitive = { n: c.length, k: 3, purityStart: purity(c, ch[0].assign), purityFinal: purity(c, ch.at(-1).assign), epochs: ch.length - 1, protos: ch.at(-1).protos.map((p) => p.map((v) => +v.toFixed(2))) };
}

// ---- 6. minimax ----
{
  const a = solve(DEFAULT_ASSETS, DEFAULT_PARAMS, true); const b = solve(DEFAULT_ASSETS, DEFAULT_PARAMS, false);
  out.minimax = { value: a.value, nodesAB: a.nodes, nodesPlain: b.nodes, naive: naiveValue(DEFAULT_ASSETS, DEFAULT_PARAMS), pv: a.pv.map((n) => n.move.label) };
}

// ---- 7. language models ----
{
  const lm = trainLm(DEFAULT_CORPUS);
  const sents = tokenizeSentences(DEFAULT_CORPUS);
  const evalModel = (model) => {
    let n = 0, top1 = 0, top3 = 0, backoff = 0;
    sents.forEach((s, si) => {
      const rest = sents.filter((_, i) => i !== si).map((x) => x.join(' ')).join('\n');
      const m = trainLm(rest);
      for (let i = 1; i < s.length; i++) {
        const r = predict(m, s.slice(0, i), model);
        const words = r.dist.map((d) => d.word);
        n++; if (words[0] === s[i]) top1++; if (words.slice(0, 3).includes(s[i])) top3++; if (r.backoff) backoff++;
      }
    });
    return { n, top1: top1 / n, top3: top3 / n, backoff: backoff / n };
  };
  const rnd = (seed) => mulberry32(seed);
  const samples = (model) => ['your appointment', 'please', 'regular', 'visit the emergency', 'drink plenty'].map((s, i) => generate(lm, s, model, { temperature: 0.7, rnd: rnd(10 + i) }).text);
  out.lm = { sentences: lm.sentences, tokens: lm.tokens, vocab: lm.vocab.length, biCtx: Object.keys(lm.bi).length, triCtx: Object.keys(lm.tri).length,
    bigram: evalModel('bigram'), trigram: evalModel('trigram'), sampleBi: samples('bigram'), sampleTri: samples('trigram') };
}

// ---- 8. 8-hour simulation (480 simulated minutes, seed 42), priority triage versus first-come-first-served ----
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const runPolicy = async (policy, ticks = 480) => {
  const s = new Simulation(); s.settings.queuePolicy = policy;
  while (!s.getSnapshot().ready) await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < ticks; i++) await s.step();
  const snap = s.getSnapshot(); const d = snap.d;
  const byPrio = {};
  for (const p of snap.patients.filter((x) => x.waited != null || x.status === 'waiting')) {
    const w = p.status === 'waiting' ? snap.tick - p.arrivalTick : p.waited;
    (byPrio[p.priority] ??= []).push(w);
  }
  const hist = snap.history; const events = snap.events;
  return {
    policy, ticks, arrived: d.totalArrived, discharged: d.discharged.length, treating: d.treating.length, waiting: d.waiting.length,
    avgWait: d.avgWait, maxWait: d.maxWait, priorityDist: d.priorityDist,
    waitByPriority: Object.fromEntries(Object.entries(byPrio).map(([k, v]) => [k, { n: v.length, avg: +avg(v).toFixed(1), max: Math.max(...v) }])),
    bedUtilAvg: +avg(hist.map((h) => h.util)).toFixed(1), bedUtilMax: Math.max(...hist.map((h) => h.util)), docUtilAvg: +avg(hist.map((h) => h.docUtil)).toFixed(1),
    peakWaiting: Math.max(...hist.map((h) => h.waiting)), alerts: snap.alerts.length, emergencyAlerts: snap.alerts.filter((a) => a.level === 'emergency').length,
    allocations: snap.patients.filter((p) => p.bedId).length,
    triageEvents: snap.patients.filter((p) => p.prolog).length,
    arrivalSig: snap.patients.map((p) => `${p.id}@${p.arrivalTick}`).join(',').length,
  };
};
out.sim = await runPolicy('priority');
out.simFcfs = await runPolicy('fcfs');
{
  const routeSim = new Simulation(); while (!routeSim.getSnapshot().ready) await new Promise((r) => setTimeout(r, 20));
  const routes = [];
  for (let i = 0; i < 12; i++) { await routeSim.triggerEmergency(); const r = routeSim.getSnapshot().lastRoute; routes.push({ found: r.found, cost: r.cost, expanded: r.expanded, ucs: r.ucsExpanded, closed: r.blocked.length }); }
  out.routes = { n: routes.length, found: routes.filter((r) => r.found).length, avgCost: avg(routes.map((r) => r.cost)), avgExpanded: avg(routes.map((r) => r.expanded)), avgUcs: avg(routes.map((r) => r.ucs)), maxClosed: Math.max(...routes.map((r) => r.closed)) };
}

writeFileSync(process.argv[2] ?? 'report-metrics.json', JSON.stringify(out, null, 2));
console.log('metrics written');
process.exit(0);

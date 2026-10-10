import { mulberry32 } from './anfis.js';

const gauss = (rnd) => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const clamp = (v) => Math.min(10, Math.max(0, v));

// ---------- PS9a: Perceptron (supervised) ----------
// Two synthetic patient classes on two indices (0-10): vital instability, lab abnormality.
export function genPerceptronData(n = 70, seed = 3, spread = 1.45) {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => {
    const cls = i % 2;
    const [cx, cy] = cls ? [7, 6.8] : [3, 3.2];
    return { x: clamp(cx + spread * gauss(rnd)), y: clamp(cy + spread * gauss(rnd)), label: cls };
  });
}

// Perceptron learning rule: w <- w + eta * (target - output) * x ; step activation.
export function trainPerceptron(data, { eta = 0.05, epochs = 40, seed = 1 } = {}) {
  const rnd = mulberry32(seed);
  let w = [rnd() * 0.2 - 0.1, rnd() * 0.2 - 0.1], b = 0;
  const history = [{ w: [...w], b, errors: data.filter((d) => (w[0] * d.x + w[1] * d.y + b >= 0 ? 1 : 0) !== d.label).length, epoch: 0 }];
  for (let e = 1; e <= epochs; e++) {
    let errors = 0;
    for (const d of data) {
      const out = w[0] * d.x + w[1] * d.y + b >= 0 ? 1 : 0;
      const delta = d.label - out;
      if (delta !== 0) { errors++; w = [w[0] + eta * delta * d.x, w[1] + eta * delta * d.y]; b += eta * delta; }
    }
    history.push({ w: [...w], b, errors, epoch: e });
    if (errors === 0) break;
  }
  return history;
}
export const perceptronPredict = (h, x, y) => (h.w[0] * x + h.w[1] * y + h.b >= 0 ? 1 : 0);

// ---------- PS9b: Competitive learning (unsupervised, winner-takes-all) ----------
export function genClusterData(n = 90, seed = 9) {
  const rnd = mulberry32(seed);
  const centers = [[2.2, 7.5], [6.2, 2.5], [8, 8]];
  return Array.from({ length: n }, (_, i) => {
    const g = i % 3;
    return { x: clamp(centers[g][0] + 0.85 * gauss(rnd)), y: clamp(centers[g][1] + 0.85 * gauss(rnd)), truth: g };
  });
}

export function trainCompetitive(data, { k = 3, eta = 0.3, epochs = 15, seed = 4 } = {}) {
  const rnd = mulberry32(seed);
  // initialise prototypes on random data points; labels are never used
  let protos = Array.from({ length: k }, () => { const d = data[Math.floor(rnd() * data.length)]; return [d.x, d.y]; });
  const assign = (ps) => data.map((d) => ps.reduce((best, p, i) => (Math.hypot(d.x - p[0], d.y - p[1]) < Math.hypot(d.x - ps[best][0], d.y - ps[best][1]) ? i : best), 0));
  const history = [{ protos: protos.map((p) => [...p]), assign: assign(protos), epoch: 0 }];
  for (let e = 1; e <= epochs; e++) {
    const lr = eta * (1 - (e - 1) / epochs); // decaying learning rate
    const order = data.map((_, i) => i).sort(() => rnd() - 0.5);
    for (const i of order) {
      const d = data[i];
      const win = protos.reduce((best, p, j) => (Math.hypot(d.x - p[0], d.y - p[1]) < Math.hypot(d.x - protos[best][0], d.y - protos[best][1]) ? j : best), 0);
      protos[win] = [protos[win][0] + lr * (d.x - protos[win][0]), protos[win][1] + lr * (d.y - protos[win][1])];
    }
    history.push({ protos: protos.map((p) => [...p]), assign: assign(protos), epoch: e });
  }
  return history;
}

// cluster purity vs hidden ground truth (only for evaluation after training)
export function purity(data, assign, k = 3) {
  let hit = 0;
  for (let c = 0; c < k; c++) {
    const counts = {};
    data.forEach((d, i) => { if (assign[i] === c) counts[d.truth] = (counts[d.truth] || 0) + 1; });
    hit += Math.max(0, ...Object.values(counts));
  }
  return hit / data.length;
}

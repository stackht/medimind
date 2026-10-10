// hybrid neuro-fuzzy model = ANFIS-style Takagi-Sugeno network.
// Layer 1 fuzzification (Gaussian MFs, trainable)  -> Layer 2 rule firing (product)
// Layer 3 normalisation -> Layer 4 linear consequents (trainable) -> Layer 5 weighted sum.
// Trained by back-propagating the squared error through all five layers.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rnd) => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

export const FEATURES = [
  { key: 'age', label: 'Age', unit: 'yr', min: 20, max: 90, def: 55 },
  { key: 'sys', label: 'Systolic BP', unit: 'mmHg', min: 90, max: 200, def: 130 },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²', min: 16, max: 42, def: 27 },
  { key: 'glucose', label: 'Glucose', unit: 'mg/dL', min: 70, max: 300, def: 110 },
];
export const norm = (f, v) => (v - f.min) / (f.max - f.min);

// Synthetic, de-identified dataset: risk driven by a hidden non-linear rule + noise.
export function genRiskData(n = 320, seed = 11) {
  const rnd = mulberry32(seed);
  const X = [], y = [];
  for (let i = 0; i < n; i++) {
    const x = FEATURES.map(() => (rnd() + rnd()) / 2); // normalised, bell-ish
    const [a, b, m, g] = x;
    let r = 0.2 * a + 0.2 * b + 0.12 * m + 0.2 * g + 0.28 * a * b * 1.3 + 0.06 * m * g;
    r = Math.min(1, Math.max(0, r * 1.15 - 0.05 + 0.03 * gauss(rnd)));
    X.push(x); y.push(r);
  }
  return { X, y };
}
export const riskCategory = (score) => (score < 35 ? 'low' : score < 60 ? 'medium' : 'high');

export class Anfis {
  constructor(nIn = 4, nMF = 2) {
    this.nIn = nIn; this.nMF = nMF;
    this.c = Array.from({ length: nIn }, () => Array.from({ length: nMF }, (_, j) => (nMF === 1 ? 0.5 : 0.3 + (0.4 * j) / (nMF - 1))));
    this.s = Array.from({ length: nIn }, () => Array(nMF).fill(0.22));
    this.nRules = nMF ** nIn;
    // rule k picks MF index idx[k][i] for input i
    this.idx = Array.from({ length: this.nRules }, (_, k) => Array.from({ length: nIn }, (_, i) => Math.floor(k / nMF ** i) % nMF));
    this.p = Array.from({ length: this.nRules }, () => [0.4, ...Array(nIn).fill(0)]);
  }
  mu(i, j, x) { const d = x - this.c[i][j]; return Math.exp(-(d * d) / (2 * this.s[i][j] ** 2)); }
  forward(x) {
    const w = this.idx.map((ix) => ix.reduce((acc, j, i) => acc * this.mu(i, j, x[i]), 1));
    const W = w.reduce((a, b) => a + b, 0) + 1e-12;
    const f = this.p.map((p) => p[0] + p.slice(1).reduce((a, pi, i) => a + pi * x[i], 0));
    const y = w.reduce((a, wk, k) => a + (wk / W) * f[k], 0);
    return { w, W, f, y };
  }
  predict(x) { return Math.min(1, Math.max(0, this.forward(x).y)); }
  trainStep(x, t, lrC = 0.08, lrP = 0.1) {
    const { w, W, f, y } = this.forward(x);
    const err = y - t;
    for (let k = 0; k < this.nRules; k++) {
      const wn = w[k] / W;
      this.p[k][0] -= lrC * err * wn;
      for (let i = 0; i < this.nIn; i++) this.p[k][i + 1] -= lrC * err * wn * x[i];
      const dEdw = err * (f[k] - y) / W;
      for (let i = 0; i < this.nIn; i++) {
        const j = this.idx[k][i];
        const d = x[i] - this.c[i][j], s = this.s[i][j];
        const g = dEdw * w[k];
        this.c[i][j] -= lrP * g * (d / (s * s));
        this.s[i][j] = Math.min(1, Math.max(0.12, this.s[i][j] - lrP * g * ((d * d) / (s * s * s))));
      }
    }
    return err * err;
  }
  epoch(X, y, rnd = Math.random) {
    const order = X.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const i of order) this.trainStep(X[i], y[i]);
  }
  rmse(X, y) { return Math.sqrt(X.reduce((a, x, i) => a + (this.predict(x) - y[i]) ** 2, 0) / X.length); }
  snapshot() { return { c: this.c.map((r) => [...r]), s: this.s.map((r) => [...r]) }; }
}

export function splitData({ X, y }, ratio = 0.75) {
  const k = Math.floor(X.length * ratio);
  return { train: { X: X.slice(0, k), y: y.slice(0, k) }, test: { X: X.slice(k), y: y.slice(k) } };
}

// Train silently (used by the dashboard pipeline so every module shares a trained model).
let cached;
export function getTrainedModel() {
  if (cached) return cached;
  const data = genRiskData();
  const { train, test } = splitData(data);
  const model = new Anfis();
  const rnd = mulberry32(5);
  for (let e = 0; e < 60; e++) model.epoch(train.X, train.y, rnd);
  cached = { model, train, test, rmse: model.rmse(test.X, test.y) };
  return cached;
}
export function scoreRisk(model, patient) {
  const x = FEATURES.map((f) => norm(f, patient[f.key]));
  return Math.round(model.predict(x) * 100);
}

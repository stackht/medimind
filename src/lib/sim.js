// One shared, deterministic (seeded) educational simulation that every dashboard page reads from.
// It calls the project's real algorithms: Prolog triage + allocation, fuzzy monitoring,
// neuro-fuzzy risk, and A* routing. All patients are synthetic.
import { mulberry32, getTrainedModel, scoreRisk, riskCategory } from './anfis.js';
import { classifyPatient, allocateAll, allocateSequential } from './prolog.js';
import { infer, VITALS_SYSTEM } from './fuzzy.js';
import { buildAdjacency, EDGES, NODE_BY_ID, edgeKey } from './graph.js';
import { astar } from './search.js';
import { destinationFor } from './patients.js';
import {
  DEPARTMENTS, DEPT_BY_CONDITION, EMERGENCY_SCENARIOS, PRIORITY_LABEL, PRIORITY_RANK, SPECIALTY_BY_DEPT,
  TREATMENT_TICKS, clockLabel, explainReason, generatePatient, resName, toPriority,
} from './simData.js';

const BED_COUNTS = { icu: 2, hdu: 2, ward: 5, day_care: 3 };
const DOCTOR_COUNTS = { cardiology: 1, pulmonology: 1, orthopaedics: 1, neurology: 1, paediatrics: 1, general_medicine: 2 };
const DIAG_COUNTS = { xray: 1, ct: 1, mri: 1, lab: 2 };
const PROLOG_LEVEL = { routine: 'low', moderate: 'medium', high: 'high', emergency: 'high' };
const BED_PREFERENCE = { high: 'icu', medium: 'ward', low: 'day_care' };

const makeList = (counts, field, prefix) => Object.entries(counts).flatMap(([key, n]) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${key}_${i + 1}`, [field]: key, free: true, patientId: null })));

const freshResources = () => ({
  beds: makeList(BED_COUNTS, 'type', ''),
  doctors: makeList(DOCTOR_COUNTS, 'specialty', 'dr_'),
  diags: makeList(DIAG_COUNTS, 'type', ''),
});
const monitor = (p) => { const r = infer(VITALS_SYSTEM, { heartRate: p.heartRate, temp: p.temp }); return { score: r.crisp, label: r.label }; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Simulation {
  constructor() {
    this.listeners = new Set();
    this.settings = { arrivalRate: 0.35, seed: 42, speed: 1, queuePolicy: 'priority' };
    this.timer = null;
    this.busy = false;
    this.gen = 0;
    this.version = 0;
    this.subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
    this.getSnapshot = () => this.snap;
    this.init();
  }

  // ---------- lifecycle ----------
  init() {
    this.gen++;
    this.rnd = mulberry32(this.settings.seed);
    this.driftRnd = mulberry32(this.settings.seed + 7919); // vitals drift uses its own stream so arrivals never depend on care decisions
    this.state = {
      ready: false, running: false, tick: 0, nextId: 1001, eventId: 1, alertId: 1,
      patients: [], resources: freshResources(), alerts: [], events: [], history: [],
      blocked: [], lastRoute: null, decisions: { triage: null, alloc: null, route: null },
    };
    this.emit();
    this.warmup(this.gen);
  }

  async warmup(gen) {
    const count = 7;
    for (let k = 0; k < count; k++) {
      await this.arrive({ arrivalTick: -((count - k) * 4) });
      if (gen !== this.gen) return;
    }
    this.state.tick = 0;
    await this.allocate(gen);
    if (gen !== this.gen) return;
    this.state.history.push(this.sample(0));
    this.log('system', `Simulation ready. ${count} synthetic patients are already in the hospital (seed ${this.settings.seed}).`);
    this.state.ready = true;
    this.emit();
  }

  emit() {
    this.snap = derive(this.state, this.settings, ++this.version);
    this.listeners.forEach((fn) => fn());
  }

  start() {
    if (this.state.running) return;
    this.state.running = true;
    this.log('system', 'Simulation started.');
    this.schedule();
    this.emit();
  }
  pause() {
    if (!this.state.running) return;
    this.state.running = false;
    clearInterval(this.timer);
    this.log('system', 'Simulation paused.');
    this.emit();
  }
  reset() {
    clearInterval(this.timer);
    this.timer = null;
    this.busy = false;
    this.init();
  }
  schedule() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.step(), 1000 / this.settings.speed);
  }
  setSpeed(speed) {
    this.settings = { ...this.settings, speed };
    if (this.state.running) this.schedule();
    this.emit();
  }
  setArrivalRate(arrivalRate) { this.settings = { ...this.settings, arrivalRate }; this.emit(); }
  setQueuePolicy(queuePolicy) { this.settings = { ...this.settings, queuePolicy }; this.log('system', `Queue policy set to ${queuePolicy === 'fcfs' ? 'first-come-first-served' : 'priority triage'}.`, { algo: 'Operator setting' }); this.emit(); }
  setSeed(seed) { this.settings = { ...this.settings, seed: Math.max(1, Math.floor(seed) || 1) }; this.emit(); }

  // ---------- logging ----------
  log(kind, text, extra = {}) {
    const s = this.state;
    s.events.push({ id: s.eventId++, t: extra.t ?? s.tick, kind, text, ...extra });
    if (s.events.length > 300) s.events.shift();
  }
  alert(level, title, text, patientId = null) {
    const s = this.state;
    s.alerts.push({ id: s.alertId++, t: s.tick, level, title, text, patientId, read: false });
    if (s.alerts.length > 60) s.alerts.shift();
    return s.alerts[s.alerts.length - 1];
  }
  sample(arrivals) {
    const s = this.state;
    const beds = s.resources.beds;
    return {
      t: s.tick, arrivals,
      waiting: s.patients.filter((p) => p.status === 'waiting').length,
      treating: s.patients.filter((p) => p.status === 'treating').length,
      util: beds.length ? Math.round((100 * beds.filter((b) => !b.free).length) / beds.length) : 0,
      docUtil: s.resources.doctors.length ? Math.round((100 * s.resources.doctors.filter((x) => !x.free).length) / s.resources.doctors.length) : 0,
    };
  }

  // ---------- patients ----------
  async arrive({ condition, forceSymptoms, custom, scenario, arrivalTick } = {}) {
    const gen = this.gen;
    const s = this.state;
    const base = custom ?? generatePatient(this.rnd, { condition, forceSymptoms });
    const p = {
      id: `P-${s.nextId++}`, ...base, arrivalTick: arrivalTick ?? s.tick, status: 'triage', priority: 'routine',
      dept: DEPT_BY_CONDITION[base.condition], scenario: scenario ?? null,
    };
    s.patients.push(p);
    if (s.patients.length > 400) {
      const i = s.patients.findIndex((x) => x.status === 'discharged');
      if (i >= 0) s.patients.splice(i, 1);
    }
    this.emit();
    const prolog = await classifyPatient({ ...p, name: p.id });
    if (gen !== this.gen) return null;
    const { model } = getTrainedModel();
    const risk = scoreRisk(model, p);
    p.prolog = { priority: prolog.priority, reasons: prolog.reasons, recommendation: prolog.recommendation, program: prolog.program };
    p.priority = toPriority(prolog);
    p.vitals = monitor(p);
    p.risk = { score: risk, category: riskCategory(risk) };
    p.status = 'waiting';
    const why = explainReason(prolog.reasons[0] ?? '');
    s.decisions.triage = { t: p.arrivalTick, patientId: p.id, algo: 'Prolog rule base', text: `${p.id} triaged as ${PRIORITY_LABEL[p.priority]}`, why };
    this.log('patient', `${p.id} arrived (${p.dept}) and was triaged as ${PRIORITY_LABEL[p.priority]}.`,
      { patientId: p.id, algo: 'Prolog rule base', why, t: p.arrivalTick });
    if (p.priority === 'emergency') {
      this.alert('emergency', scenario ?? 'Emergency-priority patient', `${p.id} (${p.dept}): ${why}.`, p.id);
    }
    this.emit();
    return p;
  }

  async addPatient(custom) {
    const p = await this.arrive({ custom });
    return p;
  }

  async triggerEmergency() {
    const gen = this.gen;
    const sc = EMERGENCY_SCENARIOS[Math.floor(this.rnd() * EMERGENCY_SCENARIOS.length)];
    const p = await this.arrive({ condition: sc.condition, forceSymptoms: sc.forceSymptoms, scenario: sc.title });
    if (!p || gen !== this.gen) return null;
    this.routeFor(p, true);
    this.emit();
    return p;
  }

  discharge(id) {
    const p = this.state.patients.find((x) => x.id === id);
    if (!p || p.status !== 'treating') return false;
    this.finish(p, 'Discharged early by operator.');
    this.emit();
    return true;
  }

  setPriority(id, level) {
    const p = this.state.patients.find((x) => x.id === id);
    if (!p || p.status === 'discharged' || p.priority === level) return false;
    const from = p.priority;
    p.priority = level;
    p.override = true;
    this.log('patient', `${p.id} priority changed from ${PRIORITY_LABEL[from]} to ${PRIORITY_LABEL[level]} (manual override).`,
      { patientId: p.id, algo: 'Manual override', why: 'Operator escalation in the simulation' });
    if (level === 'emergency') {
      this.alert('emergency', 'Escalated to Emergency', `${p.id} (${p.dept}) was escalated manually.`, p.id);
      this.routeFor(p, false);
    }
    this.emit();
    return true;
  }

  finish(p, note) {
    const r = this.state.resources;
    p.status = 'discharged';
    p.endedTick = this.state.tick;
    for (const [list, key] of [[r.beds, 'bedId'], [r.doctors, 'doctorId'], [r.diags, 'diagId']]) {
      const item = list.find((x) => x.id === p[key]);
      if (item) { item.free = true; item.patientId = null; }
    }
    this.log('patient', `${p.id} discharged from ${resName(p.bedId ?? 'care')}. ${note ?? ''}`.trim(), { patientId: p.id, algo: 'Treatment timer' });
    for (const a of this.state.alerts) if (a.patientId === p.id) a.resolved = true;
  }

  // ---------- resources ----------
  setCapacity(kind, key, n) {
    const r = this.state.resources;
    const list = r[kind];
    const field = kind === 'doctors' ? 'specialty' : 'type';
    const prefix = kind === 'doctors' ? 'dr_' : '';
    const items = list.filter((x) => x[field] === key);
    const target = clamp(n, 0, 12);
    if (target > items.length) {
      let idx = Math.max(0, ...items.map((x) => Number(x.id.split('_').pop())));
      while (list.filter((x) => x[field] === key).length < target) list.push({ id: `${prefix}${key}_${++idx}`, [field]: key, free: true, patientId: null });
    } else {
      while (list.filter((x) => x[field] === key).length > target) {
        const free = [...list].reverse().find((x) => x[field] === key && x.free);
        if (!free) { this.emit(); return { ok: false, message: `Cannot go below the ${items.length - items.filter((x) => x.free).length} in use.` }; }
        list.splice(list.indexOf(free), 1);
      }
    }
    this.log('system', `Capacity changed: ${resName(key)} ${kind === 'doctors' ? 'doctors' : 'beds'} now ${target}.`, { algo: 'Operator setting' });
    this.emit();
    return { ok: true, message: `${resName(key)} ${kind === 'doctors' ? 'doctors' : 'beds'}: ${target}` };
  }

  // ---------- routing ----------
  routeFor(p, mayCloseCorridor) {
    const s = this.state;
    const start = 'ambulance';
    const goal = destinationFor(p, 'high');
    const restrictions = new Set(['stairs']); // stretcher transport
    if (mayCloseCorridor && this.rnd() < 0.5) {
      const open = astar(buildAdjacency({ blockedEdges: new Set(s.blocked), blockedTypes: restrictions }), start, goal);
      const corridors = [];
      for (let i = 0; i < open.path.length - 1; i++) {
        const e = EDGES.find((x) => x.key === edgeKey(open.path[i], open.path[i + 1]));
        if (e && e.type === 'corridor' && !s.blocked.includes(e.key)) corridors.push(e);
      }
      if (corridors.length) {
        const e = corridors[Math.floor(this.rnd() * corridors.length)];
        const probe = astar(buildAdjacency({ blockedEdges: new Set([...s.blocked, e.key]), blockedTypes: restrictions }), start, goal);
        if (probe.found) {
          s.blocked.push(e.key);
          this.log('system', `Corridor ${NODE_BY_ID[e.a].name} to ${NODE_BY_ID[e.b].name} closed (simulated incident).`, { algo: 'Event generator' });
          this.alert('warning', 'Corridor closed', `${NODE_BY_ID[e.a].name} to ${NODE_BY_ID[e.b].name} is blocked. Routes are being recalculated.`);
        }
      }
    }
    this.computeRoute(p.id, start, goal);
  }

  computeRoute(patientId, start, goal) {
    const s = this.state;
    const adj = buildAdjacency({ blockedEdges: new Set(s.blocked), blockedTypes: new Set(['stairs']) });
    const a = astar(adj, start, goal, true);
    const u = astar(adj, start, goal, false);
    s.lastRoute = {
      patientId, start, goal, found: a.found, path: a.path, cost: a.cost, expanded: a.expanded, ucsExpanded: u.expanded,
      blocked: [...s.blocked], t: s.tick, algo: 'A*',
    };
    const text = a.found
      ? `A* routed ${patientId}: ${NODE_BY_ID[start].name} to ${NODE_BY_ID[goal].name}, ${a.cost} m.`
      : `No route found for ${patientId} to ${NODE_BY_ID[goal].name}.`;
    const why = a.found ? `Expanded ${a.expanded} nodes (uniform-cost search needs ${u.expanded}); stretcher mode excludes stairs; ${s.blocked.length} corridor(s) closed.` : 'All paths are blocked by closures or stretcher restrictions.';
    s.decisions.route = { t: s.tick, patientId, algo: 'A* search', text, why };
    this.log('system', text, { patientId, algo: 'A* search', why });
    if (!a.found) this.alert('warning', 'No route available', `${patientId} cannot reach ${NODE_BY_ID[goal].name}. Reopen a corridor.`, patientId);
  }

  toggleBlock(key) {
    const s = this.state;
    const i = s.blocked.indexOf(key);
    if (i >= 0) s.blocked.splice(i, 1); else s.blocked.push(key);
    if (s.lastRoute) this.computeRoute(s.lastRoute.patientId, s.lastRoute.start, s.lastRoute.goal);
    this.emit();
  }
  clearBlocks() {
    const s = this.state;
    s.blocked = [];
    if (s.lastRoute) this.computeRoute(s.lastRoute.patientId, s.lastRoute.start, s.lastRoute.goal);
    this.emit();
  }

  // ---------- allocation (Prolog) ----------
  async allocate(gen) {
    const s = this.state;
    const res = s.resources;
    const fcfs = this.settings.queuePolicy === 'fcfs';
    const waiting = s.patients.filter((p) => p.status === 'waiting')
      .sort((a, b) => (fcfs ? 0 : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || a.arrivalTick - b.arrivalTick).slice(0, 6);
    if (!waiting.length || !res.beds.some((b) => b.free) || !res.doctors.some((d) => d.free)) return;
    const needs = waiting.map((p) => ({ id: p.id, name: p.id, priority: PROLOG_LEVEL[p.priority], condition: p.condition, diag: p.diag }));
    const results = fcfs ? await allocateSequential(res, needs) : await allocateAll(res, needs);
    if (gen !== this.gen) return;
    for (const r of results) {
      if (r.bed === 'none' || r.doctor === 'none') continue;
      const p = s.patients.find((x) => x.id === r.patient.id);
      const bed = res.beds.find((b) => b.id === r.bed);
      const doc = res.doctors.find((d) => d.id === r.doctor);
      if (!p || !bed || !doc || !bed.free || !doc.free) continue;
      const dx = res.diags.find((d) => d.id === r.diag);
      const dur = TREATMENT_TICKS[p.priority];
      Object.assign(p, {
        status: 'treating', bedId: bed.id, doctorId: doc.id, diagId: dx ? dx.id : null,
        diagStatus: p.diag === 'none' ? 'none' : dx ? 'assigned' : 'queued',
        startTick: s.tick, waited: Math.max(0, s.tick - p.arrivalTick),
        endTick: s.tick + dur, doctorUntil: s.tick + Math.ceil(dur * 0.4), diagUntil: s.tick + 6,
      });
      bed.free = false; bed.patientId = p.id;
      doc.free = false; doc.patientId = p.id;
      if (dx) { dx.free = false; dx.patientId = p.id; }
      const wanted = BED_PREFERENCE[PROLOG_LEVEL[p.priority]];
      const stepped = bed.type !== wanted;
      const why = stepped
        ? `${resName(wanted)} beds were full, so the fallback rule stepped to ${resName(bed.type)}.`
        : `${PRIORITY_LABEL[p.priority]} priority needs ${/^[aeiou]/i.test(resName(bed.type)) ? 'an' : 'a'} ${resName(bed.type)} bed; ${resName(doc.specialty)} doctor matched the condition.`;
      s.decisions.alloc = { t: s.tick, patientId: p.id, algo: 'Prolog allocation rules', text: `${p.id} assigned ${resName(bed.id)} and ${resName(doc.id)}`, why };
      this.log('patient', `${p.id} admitted to ${resName(bed.id)} with ${resName(doc.id)}${dx ? ` and ${resName(dx.id)}` : p.diag !== 'none' ? ' (diagnostics queued)' : ''}.`,
        { patientId: p.id, algo: 'Prolog allocation rules', why });
    }
    this.emit();
  }

  // ---------- clock ----------
  async step() {
    if (this.busy) return;
    this.busy = true;
    const gen = this.gen;
    try {
      const s = this.state;
      s.tick++;
      let arrivals = 0;
      if (this.rnd() < this.settings.arrivalRate) { await this.arrive(); arrivals = 1; }
      if (gen !== this.gen) return;
      for (const p of s.patients) {
        if (p.status !== 'waiting' && p.status !== 'treating') continue;
        if (p.status === 'treating') {
          p.heartRate += Math.sign(78 - p.heartRate) * (this.driftRnd() < 0.4 ? 1 : 0);
          p.temp = Math.round((p.temp + Math.sign(37 - p.temp) * (this.driftRnd() < 0.3 ? 0.1 : 0)) * 10) / 10;
        } else {
          p.heartRate = clamp(p.heartRate + Math.round((this.driftRnd() - 0.5) * 4), 40, 190);
          p.temp = clamp(Math.round((p.temp + (this.driftRnd() - 0.5) * 0.12) * 10) / 10, 35, 41.5);
        }
        p.vitals = monitor(p);
      }
      const r = s.resources;
      for (const p of s.patients) {
        if (p.status !== 'treating') continue;
        if (s.tick >= p.endTick) this.finish(p);
        else {
          if (s.tick >= p.doctorUntil) { const d = r.doctors.find((x) => x.id === p.doctorId); if (d && !d.free) { d.free = true; d.patientId = null; } }
          if (p.diagId && s.tick >= p.diagUntil) { const d = r.diags.find((x) => x.id === p.diagId); if (d && !d.free) { d.free = true; d.patientId = null; } }
        }
      }
      await this.allocate(gen);
      if (gen !== this.gen) return;
      for (const p of s.patients) {
        if (p.status === 'waiting' && (p.priority === 'emergency' || p.priority === 'high') && s.tick - p.arrivalTick >= 15 && !p.alertedLong) {
          p.alertedLong = true;
          this.alert('warning', 'Long wait', `${p.id} (${PRIORITY_LABEL[p.priority]}) has waited ${s.tick - p.arrivalTick} min with no bed or doctor free.`, p.id);
        }
      }
      s.history.push(this.sample(arrivals));
      if (s.history.length > 240) s.history.shift();
      this.emit();
    } finally {
      this.busy = false;
    }
  }

  // ---------- alerts ----------
  markAlertsRead() { this.state.alerts.forEach((a) => { a.read = true; }); this.emit(); }
  acknowledge(id) { const a = this.state.alerts.find((x) => x.id === id); if (a) a.read = true; this.emit(); }
}

// ---------- derived data used by every page ----------
function derive(state, settings, version) {
  const P = state.patients;
  const waiting = P.filter((p) => p.status === 'waiting')
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.arrivalTick - b.arrivalTick);
  const treating = P.filter((p) => p.status === 'treating');
  const discharged = P.filter((p) => p.status === 'discharged');
  const active = P.filter((p) => p.status !== 'discharged');
  const bedTypes = Object.keys(BED_COUNTS);
  const bedsByType = Object.fromEntries(bedTypes.map((t) => {
    const items = state.resources.beds.filter((b) => b.type === t);
    return [t, { total: items.length, used: items.filter((b) => !b.free).length }];
  }));
  const bedsTotal = state.resources.beds.length;
  const bedsUsed = state.resources.beds.filter((b) => !b.free).length;
  const byDept = DEPARTMENTS.map((d) => {
    const docs = state.resources.doctors.filter((x) => x.specialty === SPECIALTY_BY_DEPT[d]);
    const w = waiting.filter((p) => p.dept === d).length;
    const t = treating.filter((p) => p.dept === d).length;
    const ratio = docs.length ? (w + t) / docs.length : w + t;
    return { dept: d, waiting: w, treating: t, doctors: docs.length, doctorsFree: docs.filter((x) => x.free).length, ratio, level: ratio >= 3 ? 'high' : ratio >= 1.5 ? 'moderate' : 'routine' };
  });
  const priorityDist = { routine: 0, moderate: 0, high: 0, emergency: 0 };
  P.filter((p) => p.status !== 'triage').forEach((p) => { priorityDist[p.priority]++; });
  const waitsOf = P.filter((p) => p.status === 'waiting' || p.waited != null).map((p) => (p.status === 'waiting' ? state.tick - p.arrivalTick : p.waited));
  const buckets = [['0-5', 0, 5], ['5-10', 5, 10], ['10-20', 10, 20], ['20-40', 20, 40], ['40+', 40, Infinity]];
  const waitDist = buckets.map(([name, lo, hi]) => ({ name, count: waitsOf.filter((w) => w >= lo && w < hi).length }));
  const busiest = [...byDept].sort((a, b) => b.ratio - a.ratio)[0];
  const hist = state.history;
  const prev = hist.length > 10 ? hist[hist.length - 11] : hist[0];
  const now = hist[hist.length - 1];
  const activeEmergencies = active.filter((p) => p.priority === 'emergency');
  const unread = state.alerts.filter((a) => !a.read).length;
  const diagsBusy = state.resources.diags.filter((d) => !d.free).length;
  return {
    ...state, version, settings, clock: clockLabel(state.tick),
    d: {
      waiting, treating, discharged, active, bedsByType, bedsTotal, bedsUsed, bedsFree: bedsTotal - bedsUsed,
      byDept, busiest, priorityDist, waitDist, activeEmergencies, unread, diagsBusy,
      doctorsTotal: state.resources.doctors.length, doctorsFree: state.resources.doctors.filter((x) => x.free).length,
      avgWait: waitsOf.length ? Math.round(waitsOf.reduce((a, b) => a + b, 0) / waitsOf.length) : 0,
      maxWait: waitsOf.length ? Math.max(...waitsOf) : 0,
      trend: { waiting: now && prev ? now.waiting - prev.waiting : 0, util: now && prev ? now.util - prev.util : 0 },
      totalArrived: P.length,
    },
  };
}

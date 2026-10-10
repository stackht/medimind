// Hospital floor plan modelled as a weighted graph (state space).
// State = patient location, action = move to a connected location.
export const SCALE = 0.2; // pixels -> metres
const FACTOR = { corridor: 1, lift: 1.3, stairs: 1.6 };

export const NODES = [
  // Ground floor
  { id: 'ambulance', name: 'Ambulance Bay', x: 80, y: 350, floor: 0 },
  { id: 'entrance', name: 'Main Entrance', x: 80, y: 480, floor: 0 },
  { id: 'er', name: 'Emergency Room', x: 215, y: 350, floor: 0 },
  { id: 'reception', name: 'Reception', x: 215, y: 480, floor: 0 },
  { id: 'triage', name: 'Triage Desk', x: 350, y: 350, floor: 0 },
  { id: 'pharmacy', name: 'Pharmacy', x: 350, y: 480, floor: 0 },
  { id: 'radiology', name: 'Radiology', x: 485, y: 350, floor: 0 },
  { id: 'lab', name: 'Pathology Lab', x: 485, y: 480, floor: 0 },
  { id: 'lift0', name: 'Lift (G)', x: 620, y: 415, floor: 0 },
  { id: 'stairs0', name: 'Stairs (G)', x: 770, y: 415, floor: 0 },
  { id: 'opd', name: 'OPD Clinics', x: 770, y: 495, floor: 0 },
  // First floor
  { id: 'ot', name: 'Operating Theatre', x: 215, y: 70, floor: 1 },
  { id: 'icu', name: 'ICU', x: 350, y: 70, floor: 1 },
  { id: 'cardio', name: 'Cardiology', x: 485, y: 70, floor: 1 },
  { id: 'wardB', name: 'Ward B', x: 215, y: 175, floor: 1 },
  { id: 'wardA', name: 'Ward A', x: 350, y: 175, floor: 1 },
  { id: 'peds', name: 'Paediatrics', x: 485, y: 175, floor: 1 },
  { id: 'lift1', name: 'Lift (1)', x: 620, y: 120, floor: 1 },
  { id: 'stairs1', name: 'Stairs (1)', x: 770, y: 120, floor: 1 },
];

const RAW_EDGES = [
  ['ambulance', 'er', 'corridor'], ['ambulance', 'entrance', 'corridor'],
  ['entrance', 'reception', 'corridor'], ['reception', 'er', 'corridor'],
  ['er', 'triage', 'corridor'], ['triage', 'radiology', 'corridor'],
  ['triage', 'pharmacy', 'corridor'], ['reception', 'pharmacy', 'corridor'],
  ['pharmacy', 'lab', 'corridor'], ['lab', 'radiology', 'corridor'],
  ['radiology', 'lift0', 'corridor'], ['lab', 'lift0', 'corridor'],
  ['lift0', 'stairs0', 'corridor'], ['stairs0', 'opd', 'corridor'], ['lab', 'opd', 'corridor'],
  ['lift0', 'lift1', 'lift'], ['stairs0', 'stairs1', 'stairs'],
  ['lift1', 'stairs1', 'corridor'], ['lift1', 'cardio', 'corridor'], ['lift1', 'peds', 'corridor'],
  ['stairs1', 'cardio', 'corridor'], ['cardio', 'icu', 'corridor'], ['icu', 'ot', 'corridor'],
  ['cardio', 'peds', 'corridor'], ['icu', 'wardA', 'corridor'], ['ot', 'wardB', 'corridor'],
  ['wardA', 'wardB', 'corridor'], ['wardA', 'peds', 'corridor'],
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
export const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const euclid = (a, b) => Math.hypot(NODE_BY_ID[a].x - NODE_BY_ID[b].x, NODE_BY_ID[a].y - NODE_BY_ID[b].y);

export const EDGES = RAW_EDGES.map(([a, b, type]) => ({
  a, b, type, key: edgeKey(a, b),
  cost: Math.ceil(euclid(a, b) * SCALE * FACTOR[type]),
}));

// h(n): straight-line distance in metres. Admissible: every edge cost >= straight-line length.
export const heuristic = (id, goal) => Math.round(euclid(id, goal) * SCALE * 10) / 10;

export function buildAdjacency({ blockedEdges = new Set(), blockedTypes = new Set(), blockedNodes = new Set() } = {}) {
  const adj = Object.fromEntries(NODES.map((n) => [n.id, []]));
  for (const e of EDGES) {
    if (blockedEdges.has(e.key) || blockedTypes.has(e.type)) continue;
    if (blockedNodes.has(e.a) || blockedNodes.has(e.b)) continue;
    adj[e.a].push({ to: e.b, cost: e.cost, type: e.type, key: e.key });
    adj[e.b].push({ to: e.a, cost: e.cost, type: e.type, key: e.key });
  }
  return adj;
}

export const DEPARTMENTS = NODES.filter((n) => !['lift0', 'lift1', 'stairs0', 'stairs1'].includes(n.id));

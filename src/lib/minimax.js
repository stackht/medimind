// Minimax game between a Defender (MAX) and an Attacker (MIN) over hospital digital assets.
// Utility is from the defender's point of view and uses predefined values.
export const DEFAULT_ASSETS = [
  { id: 'ehr', name: 'Patient-Record DB', value: 100 },
  { id: 'lab', name: 'Lab & Imaging Server', value: 60 },
  { id: 'portal', name: 'Appointment Portal', value: 30 },
];
export const DEFAULT_PARAMS = { shieldCost: 8, leak: 0.15, rounds: 2 };

// state: {shielded:Set-like object, breached:{}, cost, loss, ply}
// Each round: defender hardens ONE asset (or passes), then attacker attacks ONE asset.
function apply(state, move, assets, params) {
  const s = { shielded: { ...state.shielded }, breached: { ...state.breached }, cost: state.cost, loss: state.loss, ply: state.ply + 1 };
  if (move.type === 'shield') { s.shielded[move.asset] = true; s.cost += params.shieldCost; }
  if (move.type === 'attack' && !s.breached[move.asset]) {
    const a = assets.find((x) => x.id === move.asset);
    s.loss += a.value * (s.shielded[move.asset] ? params.leak : 1);
    s.breached[move.asset] = true;
  }
  return s;
}
const utility = (s) => -(s.loss + s.cost);

function movesFor(state, assets) {
  const defenderTurn = state.ply % 2 === 0;
  if (defenderTurn) {
    return [...assets.filter((a) => !state.shielded[a.id]).map((a) => ({ type: 'shield', asset: a.id, label: `Harden ${a.name}` })),
      { type: 'pass', label: 'Hold reserves (no action)' }];
  }
  return assets.map((a) => ({ type: 'attack', asset: a.id, label: `Attack ${a.name}` }));
}

export function solve(assets = DEFAULT_ASSETS, params = DEFAULT_PARAMS, alphaBeta = true) {
  let nodes = 0;
  const maxPly = params.rounds * 2;
  function rec(state, alpha, beta, move) {
    nodes++;
    const node = { move, ply: state.ply, player: state.ply % 2 === 0 ? 'defender' : 'attacker', children: [] };
    if (state.ply >= maxPly) { node.value = utility(state); node.leaf = true; node.state = state; return node; }
    const isMax = state.ply % 2 === 0;
    let best = isMax ? -Infinity : Infinity;
    let cut = false;
    for (const m of movesFor(state, assets)) {
      if (cut) { node.children.push({ move: m, pruned: true, ply: state.ply + 1, children: [] }); continue; }
      const child = rec(apply(state, m, assets, params), alpha, beta, m);
      node.children.push(child);
      if (isMax ? child.value > best : child.value < best) { best = child.value; node.best = child; }
      if (isMax) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
      if (alphaBeta && beta <= alpha) cut = true;
    }
    node.value = best;
    return node;
  }
  const root = rec({ shielded: {}, breached: {}, cost: 0, loss: 0, ply: 0 }, -Infinity, Infinity, null);
  // principal variation = optimal play for both sides
  const pv = [];
  for (let n = root; n.best; n = n.best) pv.push(n.best);
  markPV(root);
  return { root, nodes, pv, value: root.value };
}
function markPV(n) { n.onPV = true; if (n.best) markPV(n.best); }

// A naive defender who never defends, for comparison with the optimal strategy.
export function naiveValue(assets, params) {
  const sorted = [...assets].sort((a, b) => b.value - a.value);
  return -sorted.slice(0, params.rounds).reduce((a, x) => a + x.value, 0);
}

import { useMemo, useState } from 'react';
import { usePatient } from '../context/PatientContext.jsx';
import { buildAdjacency, DEPARTMENTS, NODE_BY_ID, edgeKey } from '../lib/graph.js';
import { astar } from '../lib/search.js';
import { destinationFor } from '../lib/patients.js';
import HospitalMap, { MapLegend } from '../components/HospitalMap.jsx';
import { Card, Explain, PageHeader, PlayerBar, Select, Stat, usePlayer } from '../components/ui.jsx';

const opts = DEPARTMENTS.map((n) => [n.id, n.name]);
const nm = (id) => NODE_BY_ID[id].name;

export default function Emergency() {
  const { patient } = usePatient();
  const [start, setStart] = useState('ambulance');
  const [goal, setGoal] = useState(() => destinationFor(patient, 'high'));
  const [blocked, setBlocked] = useState(() => new Set([edgeKey('triage', 'radiology')]));
  const [noStairs, setNoStairs] = useState(true);
  const [liftDown, setLiftDown] = useState(false);

  const disabledTypes = useMemo(() => new Set([...(noStairs ? ['stairs'] : []), ...(liftDown ? ['lift'] : [])]), [noStairs, liftDown]);
  const adj = useMemo(() => buildAdjacency({ blockedEdges: blocked, blockedTypes: disabledTypes }), [blocked, disabledTypes]);
  const a = useMemo(() => astar(adj, start, goal, true), [adj, start, goal]);
  const u = useMemo(() => astar(adj, start, goal, false), [adj, start, goal]);
  const player = usePlayer(a.steps.length, 750);
  const step = a.steps[player.i];
  const atEnd = player.i === a.steps.length - 1;

  const toggleEdge = (e) => {
    if (e.type !== 'corridor') return;
    const n = new Set(blocked);
    n.has(e.key) ? n.delete(e.key) : n.add(e.key);
    setBlocked(n); player.reset();
  };
  const reset = () => player.reset();

  return (
    <div className="stack">
      <PageHeader ps="PS 4 · Emergency Patient Route Optimization" title="Emergency Router with A*"
        desc="A* finds the lowest-cost route using f(n) = g(n) + h(n): distance travelled so far plus a straight-line estimate to the goal. Block corridors or apply transport restrictions and the route is re-planned instantly."
        tags={['A* search', 'Heuristic function', 'Graph traversal', 'Constraints']} />

      <div className="grid g-map">
        <Card title="Emergency transfer map" sub="Click any corridor to block or reopen it (red ✕). Open-list nodes show g, h and f.">
          <HospitalMap start={start} goal={goal} current={step.current} closed={step.closed} frontier={step.frontier}
            path={atEnd && a.found ? a.path : []} blockedEdges={blocked} disabledTypes={disabledTypes} onEdgeClick={toggleEdge} scores={step.scores} />
          <MapLegend astar />
          <div style={{ marginTop: 12 }}>{a.found ? <PlayerBar player={player} length={a.steps.length} /> : null}</div>
        </Card>

        <div className="stack">
          <Card title="Transfer request">
            <Select label="From" value={start} onChange={(v) => { setStart(v); reset(); }} options={opts} />
            <Select label="To (suitable facility)" value={goal} onChange={(v) => { setGoal(v); reset(); }} options={opts} />
            <label className="check"><input type="checkbox" checked={noStairs} onChange={(e) => { setNoStairs(e.target.checked); reset(); }} /> Stretcher transport: stairs not allowed</label>
            <label className="check"><input type="checkbox" checked={liftDown} onChange={(e) => { setLiftDown(e.target.checked); reset(); }} /> Lift out of service</label>
            <div className="row spread">
              <span className="note">{blocked.size} corridor(s) blocked</span>
              <button className="btn sm" onClick={() => { setBlocked(new Set()); reset(); }}>Clear blocks</button>
            </div>
          </Card>

          {a.found ? (
            <Card title="Optimal route found">
              <div className="grid g3" style={{ gap: 10, marginBottom: 12 }}>
                <Stat k="Cost (m)" v={a.cost} />
                <Stat k="A* expanded" v={a.expanded} />
                <Stat k="UCS expanded" v={u.expanded} />
              </div>
              <div className="note" style={{ marginBottom: 10 }}>{a.path.map(nm).join(' → ')}</div>
              <Explain title="Why A*">With h(n) the search is guided toward the goal and expanded {a.expanded} nodes instead of {u.expanded} for uniform-cost search, with the same optimal cost. h(n) is the straight-line distance, which never over-estimates (admissible), so optimality is guaranteed.</Explain>
            </Card>
          ) : (
            <Card title="No route available">
              <div className="explain" style={{ borderColor: 'var(--high)', background: 'var(--high-soft)' }}>Every path is blocked by the current restrictions. Reopen a corridor or relax a transport restriction.</div>
            </Card>
          )}
        </div>
      </div>

      {a.found && (
        <Card title="A* trace" sub="Each row is one expansion: the node with the lowest f = g + h leaves the open list.">
          <div className="scroll"><table className="tbl">
            <thead><tr><th>#</th><th>Expanded node</th><th>g (cost so far)</th><th>h (estimate)</th><th>f</th><th>Open list</th></tr></thead>
            <tbody>
              {a.steps.map((s, i) => (
                <tr key={i} className={i === player.i ? 'hl' : ''} onClick={() => player.set(i)} style={{ cursor: 'pointer' }}>
                  <td>{i + 1}</td><td><b>{nm(s.current)}</b></td><td className="mono">{s.g}</td><td className="mono">{s.h}</td><td className="mono">{s.f}</td>
                  <td className="note">{s.frontier.map(nm).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}
    </div>
  );
}

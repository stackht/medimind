import { useMemo, useState } from 'react';
import { usePatient } from '../context/PatientContext.jsx';
import { buildAdjacency, DEPARTMENTS, NODE_BY_ID } from '../lib/graph.js';
import { bfs, dfs } from '../lib/search.js';
import { destinationFor } from '../lib/patients.js';
import HospitalMap, { MapLegend } from '../components/HospitalMap.jsx';
import { Card, Explain, PageHeader, PlayerBar, Select, Seg, Stat, usePlayer } from '../components/ui.jsx';

const opts = DEPARTMENTS.map((n) => [n.id, n.name]);
const nm = (id) => NODE_BY_ID[id].name;

export default function Navigation() {
  const { patient } = usePatient();
  const [start, setStart] = useState('entrance');
  const [goal, setGoal] = useState(() => destinationFor(patient, 'medium'));
  const [algo, setAlgo] = useState('bfs');
  const adj = useMemo(() => buildAdjacency(), []);
  const results = useMemo(() => ({ bfs: bfs(adj, start, goal), dfs: dfs(adj, start, goal) }), [adj, start, goal]);
  const r = results[algo];
  const player = usePlayer(r.steps.length, 700);
  const step = r.steps[player.i];
  const atEnd = player.i === r.steps.length - 1;

  return (
    <div className="stack">
      <PageHeader ps="PS 1 · Patient Navigation using AI Search" title="Patient Navigation with BFS and DFS"
        desc="The hospital is a state space: each location is a state, each corridor, lift or staircase is an action, and the cost is walking distance. Compare how breadth-first and depth-first search explore it."
        tags={['State-space search', 'BFS', 'DFS', 'Graph traversal']} />

      <div className="grid g-map">
        <Card title="Hospital state space" sub="Press Play to watch the search expand nodes. Click two departments on the map to set the route." right={<Seg value={algo} onChange={(a) => { setAlgo(a); player.reset(); }} options={[['bfs', 'BFS'], ['dfs', 'DFS']]} />}>
          <HospitalMap start={start} goal={goal} current={step.current} closed={step.closed} frontier={step.frontier}
            path={atEnd ? r.path : []} onNodeClick={(id) => { if (opts.some(([v]) => v === id)) { setStart(id); player.reset(); } }} />
          <MapLegend />
          <div style={{ marginTop: 12 }}><PlayerBar player={player} length={r.steps.length} /></div>
        </Card>

        <div className="stack">
          <Card title="Route request">
            <Select label="Current location (start state)" value={start} onChange={(v) => { setStart(v); player.reset(); }} options={opts} />
            <Select label="Required department (goal state)" value={goal} onChange={(v) => { setGoal(v); player.reset(); }} options={opts} />
            <div className="note">Suggested for {patient.name}: <button className="chip" onClick={() => { setGoal(destinationFor(patient, 'medium')); player.reset(); }}>{nm(destinationFor(patient, 'medium'))}</button></div>
          </Card>
          <Card title={`${r.algo} data structure`} sub={algo === 'bfs' ? 'FIFO queue: oldest discovered node first.' : 'LIFO stack: newest discovered node first.'}>
            <div className="lbl">Expanding</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{nm(step.current)}</div>
            <div className="lbl">{algo === 'bfs' ? 'Queue (front → back)' : 'Stack (top → bottom)'}</div>
            <div className="chips" style={{ marginTop: 4 }}>
              {(algo === 'dfs' ? [...step.frontier].reverse() : step.frontier).map((f) => <span key={f} className="tag info">{nm(f)}</span>)}
              {!step.frontier.length && <span className="muted">empty</span>}
            </div>
          </Card>
        </div>
      </div>

      <Card title="BFS vs DFS on this request" sub="Same graph, same start and goal.">
        <div className="grid g2">
          {['bfs', 'dfs'].map((k) => {
            const x = results[k];
            return (
              <div key={k} className="stack" style={{ gap: 10 }}>
                <div className="row spread"><b>{x.algo}</b></div>
                <div className="grid g3" style={{ gap: 10 }}>
                  <Stat k="Hops" v={x.path.length - 1} />
                  <Stat k="Distance (m)" v={x.cost} />
                  <Stat k="Expanded" v={x.expanded} />
                </div>
                <div className="note">{x.path.map(nm).join(' → ')}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          <Explain title="Takeaway">BFS finds the path with the <b>fewest hops</b> ({results.bfs.path.length - 1}), which is not always the cheapest in metres. DFS may wander through unrelated wings first and return a longer route ({results.dfs.cost} m vs {results.bfs.cost} m here). Neither uses edge costs; the Emergency Router adds those with A*.</Explain>
        </div>
      </Card>
    </div>
  );
}

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSim } from '../context/SimContext.jsx';
import HospitalMap, { MapLegend } from '../components/HospitalMap.jsx';
import { EventFeed, PriorityBadge, SimControls } from '../components/dash.jsx';
import { Card, Explain } from '../components/ui.jsx';
import { EDGES, NODE_BY_ID, edgeKey } from '../lib/graph.js';

const STRETCHER = new Set(['stairs']);

export default function Routing() {
  const { snap, sim } = useSim();
  const r = snap.lastRoute;
  const blocked = useMemo(() => new Set(snap.blocked), [snap.blocked]);
  const patient = r ? snap.patients.find((p) => p.id === r.patientId) : null;
  const hops = useMemo(() => {
    if (!r?.found) return [];
    return r.path.slice(0, -1).map((n, i) => {
      const e = EDGES.find((x) => x.key === edgeKey(n, r.path[i + 1]));
      return { from: NODE_BY_ID[n].name, to: NODE_BY_ID[r.path[i + 1]].name, cost: e.cost, type: e.type };
    });
  }, [r]);
  const events = snap.events.filter((e) => e.algo === 'A* search' || e.algo === 'Event generator').slice(-8).reverse();
  const onEdge = (e) => { if (e.type === 'corridor') sim.toggleBlock(e.key); };

  return (
    <div>
      <div className="page-title-row"><div><h1>Emergency routing</h1><p>A* finds the lowest-cost route for stretcher transport from the Ambulance Bay to a suitable facility. Corridors can close at any time and the route is recalculated.</p></div></div>
      <SimControls compact />
      {!r ? (
        <div className="empty"><b>No emergency route yet</b>Press “Trigger emergency” above. A patient arrives by ambulance and A* plans the transfer.</div>
      ) : (
        <div className="grid g-map">
          <Card title="Transfer route" sub="Click a corridor to close or reopen it. Stairs are excluded for stretcher transport.">
            <HospitalMap start={r.start} goal={r.goal} path={r.found ? r.path : []} blockedEdges={blocked} disabledTypes={STRETCHER} onEdgeClick={onEdge} />
            <MapLegend astar />
            <div className="legend" style={{ marginTop: 6 }}><span><i className="dot" style={{ background: 'var(--bad)' }} />Red ✕ = closed corridor</span><span>Thick teal line = selected route</span></div>
          </Card>
          <div className="stack">
            <Card title={r.found ? 'Selected route' : 'No route available'} right={<span className="algo-tag">Algorithm: {r.algo}</span>}>
              <div className="row" style={{ marginBottom: 10 }}>
                <b>{r.patientId}</b>{patient && <PriorityBadge level={patient.priority} />}{patient && <span className="note">{patient.dept}</span>}
                <Link to="/patients" state={{ openId: r.patientId }} className="btn sm">View patient</Link>
              </div>
              {r.found ? (
                <>
                  <div className="grid g3" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="stat"><div className="k">Route cost</div><div className="v">{r.cost}</div><div className="s">metres</div></div>
                    <div className="stat"><div className="k">A* expanded</div><div className="v">{r.expanded}</div><div className="s">nodes</div></div>
                    <div className="stat"><div className="k">No heuristic</div><div className="v">{r.ucsExpanded}</div><div className="s">nodes</div></div>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                    {hops.map((h, i) => <li key={i} style={{ padding: '2px 0' }}>{h.from} to {h.to} <span className="mono muted">{h.cost} m{h.type !== 'corridor' ? ` · ${h.type}` : ''}</span></li>)}
                  </ol>
                </>
              ) : <div className="alert-item warning"><div className="txt">Every path to {NODE_BY_ID[r.goal].name} is blocked. Reopen a corridor on the map.</div></div>}
              <div style={{ marginTop: 12 }}><Explain title="Why this route">f(n) = g(n) + h(n): cost so far plus the straight-line distance to {NODE_BY_ID[r.goal].name}. That heuristic never overestimates, so the route is optimal while A* expands fewer nodes than uniform-cost search.</Explain></div>
            </Card>
            <Card title="Closed corridors" right={<button className="btn sm" onClick={() => sim.clearBlocks()} disabled={!snap.blocked.length}>Reopen all</button>}>
              {snap.blocked.length === 0 ? <div className="note">All corridors are open.</div> : (
                <div className="stack" style={{ gap: 6 }}>
                  {snap.blocked.map((k) => { const [a, b] = k.split('|'); return (
                    <div key={k} className="row spread nowrap"><span>{NODE_BY_ID[a].name} to {NODE_BY_ID[b].name}</span><button className="btn sm" onClick={() => sim.toggleBlock(k)}>Reopen</button></div>
                  ); })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
      <div style={{ marginTop: 16 }}><Card title="Routing log"><EventFeed events={events} empty="Route calculations and corridor closures appear here." /></Card></div>
    </div>
  );
}

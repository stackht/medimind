import { NODES, EDGES, NODE_BY_ID } from '../lib/graph.js';

const EDGE_STYLE = {
  corridor: { stroke: '#b6c7d0', dash: undefined },
  lift: { stroke: '#0b7a8f', dash: '6 4' },
  stairs: { stroke: '#d08a1c', dash: '3 4' },
};

export default function HospitalMap({
  start, goal, current, closed = [], frontier = [], path = [], blockedEdges, disabledTypes, onEdgeClick, onNodeClick, scores, showCost = true,
}) {
  const closedSet = new Set(closed), frontierSet = new Set(frontier), pathSet = new Set();
  for (let i = 0; i < path.length - 1; i++) pathSet.add(path[i] < path[i + 1] ? `${path[i]}|${path[i + 1]}` : `${path[i + 1]}|${path[i]}`);
  const pathNodes = new Set(path);

  const fill = (id) => {
    if (id === current) return '#0b7a8f';
    if (id === start) return '#218a5b';
    if (id === goal) return '#c93a31';
    if (pathNodes.has(id)) return '#cfeef3';
    if (closedSet.has(id)) return '#e3f3f6';
    return '#ffffff';
  };
  const stroke = (id) => (frontierSet.has(id) ? '#e08a1e' : id === start ? '#218a5b' : id === goal ? '#c93a31' : pathNodes.has(id) ? '#0b7a8f' : '#8fa7b3');

  return (
    <div className="map-wrap">
      <svg viewBox="0 0 860 560" role="img" aria-label="Hospital floor plan graph">
        <rect x="16" y="14" width="828" height="224" rx="14" fill="#ffffff" stroke="#e0e9ee" />
        <rect x="16" y="282" width="828" height="266" rx="14" fill="#ffffff" stroke="#e0e9ee" />
        <text x="32" y="38" fontSize="13" fontWeight="700" letterSpacing="1.2" fill="#7b909b">FIRST FLOOR</text>
        <text x="32" y="306" fontSize="13" fontWeight="700" letterSpacing="1.2" fill="#7b909b">GROUND FLOOR</text>

        {EDGES.map((e) => {
          const a = NODE_BY_ID[e.a], b = NODE_BY_ID[e.b];
          const blocked = blockedEdges?.has(e.key) || disabledTypes?.has(e.type);
          const onPath = pathSet.has(e.key);
          const st = EDGE_STYLE[e.type];
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          return (
            <g key={e.key} className={onEdgeClick ? 'edge' : ''} onClick={() => onEdgeClick?.(e)}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="16" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={blocked ? '#c93a31' : onPath ? '#0b7a8f' : st.stroke}
                strokeWidth={onPath ? 5 : blocked ? 2.5 : 2.5}
                strokeDasharray={blocked ? '2 5' : st.dash}
                strokeLinecap="round" opacity={blocked ? 0.9 : 1} />
              {blocked ? (
                <g>
                  <circle cx={mx} cy={my} r="11" fill="#fff" stroke="#c93a31" />
                  <path d={`M${mx - 4} ${my - 4}L${mx + 4} ${my + 4}M${mx + 4} ${my - 4}L${mx - 4} ${my + 4}`} stroke="#c93a31" strokeWidth="2" />
                </g>
              ) : showCost ? (
                <g>
                  <rect x={mx - 16} y={my - 11} width="32" height="21" rx="10" fill="#fff" opacity="0.92" />
                  <text x={mx} y={my + 4} fontSize="15" textAnchor="middle" fill={onPath ? '#075d6d' : '#4a6572'} fontWeight={onPath ? 700 : 500}>{e.cost}</text>
                </g>
              ) : null}
            </g>
          );
        })}

        {NODES.map((n) => {
          const sc = scores?.[n.id];
          return (
            <g key={n.id} onClick={() => onNodeClick?.(n.id)} style={{ cursor: onNodeClick ? 'pointer' : 'default' }}>
              <circle cx={n.x} cy={n.y} r="17" fill={fill(n.id)} stroke={stroke(n.id)} strokeWidth={frontierSet.has(n.id) || n.id === start || n.id === goal ? 3 : 2} />
              {n.id === current && <circle cx={n.x} cy={n.y} r="23" fill="none" stroke="#0b7a8f" strokeWidth="2" opacity="0.4" />}
              <text x={n.x} y={n.y + 5} fontSize="16" fontWeight="700" textAnchor="middle" fill={n.id === current || n.id === start || n.id === goal ? '#fff' : '#12303b'}>
                {n.id === start ? 'S' : n.id === goal ? 'G' : ''}
              </text>
              <text className="node-label" x={n.x} y={n.y + 40} textAnchor="middle">{n.name}</text>
              {sc && (
                <text x={n.x} y={n.y - 26} fontSize="15" textAnchor="middle" fill="#075d6d" fontWeight="600">
                  g{sc.g} h{sc.h} f{sc.f}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function MapLegend({ astar }) {
  return (
    <div className="legend" style={{ marginTop: 10 }}>
      <span><i className="dot" style={{ background: '#218a5b' }} />Start</span>
      <span><i className="dot" style={{ background: '#c93a31' }} />Goal</span>
      <span><i className="dot" style={{ background: '#0b7a8f' }} />Expanding now</span>
      <span><i className="dot" style={{ background: '#e3f3f6', border: '1.5px solid #8fa7b3' }} />Explored</span>
      <span><i className="dot" style={{ background: '#fff', border: '2.5px solid #e08a1e' }} />{astar ? 'Open list' : 'Frontier'}</span>
      <span>Dashed teal = lift · dotted amber = stairs · numbers = cost (m)</span>
    </div>
  );
}

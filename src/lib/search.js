import { heuristic } from './graph.js';

function buildPath(parent, goal) {
  const path = [];
  for (let n = goal; n != null; n = parent[n]) path.unshift(n);
  return path;
}
function pathCost(adj, path) {
  let c = 0;
  for (let i = 0; i < path.length - 1; i++) c += adj[path[i]].find((e) => e.to === path[i + 1]).cost;
  return c;
}

// Breadth-first search: FIFO queue -> fewest hops.
export function bfs(adj, start, goal) {
  const parent = { [start]: null };
  const queue = [start];
  const closed = [];
  const steps = [];
  while (queue.length) {
    const cur = queue.shift();
    closed.push(cur);
    steps.push({ current: cur, frontier: [...queue], closed: [...closed] });
    if (cur === goal) break;
    for (const { to } of adj[cur]) {
      if (!(to in parent)) { parent[to] = cur; queue.push(to); }
    }
  }
  const found = closed.includes(goal);
  const path = found ? buildPath(parent, goal) : [];
  return { algo: 'BFS', found, path, cost: found ? pathCost(adj, path) : 0, steps, expanded: closed.length };
}

// Depth-first search: LIFO stack -> dives deep, path not guaranteed short.
export function dfs(adj, start, goal) {
  const parent = {};
  const stack = [[start, null]];
  const closed = [];
  const steps = [];
  let found = false;
  while (stack.length) {
    const [cur, par] = stack.pop();
    if (closed.includes(cur)) continue;
    parent[cur] = par;
    closed.push(cur);
    steps.push({
      current: cur,
      frontier: [...new Set(stack.map((s) => s[0]).filter((n) => !closed.includes(n)))],
      closed: [...closed],
    });
    if (cur === goal) { found = true; break; }
    for (let i = adj[cur].length - 1; i >= 0; i--) {
      const to = adj[cur][i].to;
      if (!closed.includes(to)) stack.push([to, cur]);
    }
  }
  const path = found ? buildPath(parent, goal) : [];
  return { algo: 'DFS', found, path, cost: found ? pathCost(adj, path) : 0, steps, expanded: closed.length };
}

// A* search: f(n) = g(n) + h(n). useHeuristic=false degrades to uniform-cost search.
export function astar(adj, start, goal, useHeuristic = true) {
  const h = (n) => (useHeuristic ? heuristic(n, goal) : 0);
  const g = { [start]: 0 };
  const parent = { [start]: null };
  const open = [start];
  const closed = [];
  const steps = [];
  let found = false;
  while (open.length) {
    open.sort((a, b) => g[a] + h(a) - (g[b] + h(b)) || h(a) - h(b));
    const cur = open.shift();
    closed.push(cur);
    steps.push({
      current: cur, g: g[cur], h: h(cur), f: Math.round((g[cur] + h(cur)) * 10) / 10,
      frontier: [...open], closed: [...closed],
      scores: Object.fromEntries([cur, ...open].map((n) => [n, { g: g[n], h: h(n), f: Math.round((g[n] + h(n)) * 10) / 10 }])),
    });
    if (cur === goal) { found = true; break; }
    for (const { to, cost } of adj[cur]) {
      if (closed.includes(to)) continue;
      const ng = g[cur] + cost;
      if (g[to] === undefined || ng < g[to]) {
        g[to] = ng; parent[to] = cur;
        if (!open.includes(to)) open.push(to);
      }
    }
  }
  const path = found ? buildPath(parent, goal) : [];
  return { algo: useHeuristic ? 'A*' : 'UCS', found, path, cost: found ? g[goal] : 0, steps, expanded: closed.length };
}

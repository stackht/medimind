import { useMemo, useState } from 'react';
import { solve, naiveValue, DEFAULT_ASSETS, DEFAULT_PARAMS } from '../lib/minimax.js';
import { Card, Explain, PageHeader, Seg, Slider, Stat } from '../components/ui.jsx';

function TreeNode({ node, depth, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const kids = node.children ?? [];
  const mover = node.move ? (node.ply % 2 === 1 ? 'd' : 'a') : null; // ply here = ply after the move
  return (
    <li>
      <span className={`tnode ${node.onPV ? 'pv' : ''} ${node.pruned ? 'pruned' : ''}`} onClick={() => kids.length && setOpen(!open)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && kids.length && setOpen(!open)}>
        {mover && <span className={`pl ${mover}`}>{mover === 'd' ? 'DEF' : 'ATK'}</span>}
        <span>{node.move ? node.move.label : 'Start of game'}</span>
        {node.pruned ? <span className="note">pruned (α-β)</span> : <span className="v">{node.value}</span>}
        {kids.length > 0 && <span className="note">{open ? '▾' : '▸'}</span>}
      </span>
      {open && kids.length > 0 && <ul>{kids.map((k, i) => <TreeNode key={i} node={k} depth={depth + 1} defaultOpen={k.onPV && depth < 4} />)}</ul>}
    </li>
  );
}

export default function Security() {
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [ab, setAb] = useState('on');
  const withAB = useMemo(() => solve(assets, params, true), [assets, params]);
  const without = useMemo(() => solve(assets, params, false), [assets, params]);
  const res = ab === 'on' ? withAB : without;
  const naive = naiveValue(assets, params);
  const setVal = (id, value) => setAssets(assets.map((a) => (a.id === id ? { ...a, value } : a)));

  return (
    <div className="stack">
      <PageHeader title="Security Operations with Minimax"
        desc="A defender with limited hardening resources protects hospital servers against a hypothetical attacker. Both play optimally: the defender maximises its utility, the attacker minimises it. Minimax searches the game tree to find the best defensive strategy."
        tags={['Minimax', 'Game tree', 'Utility evaluation', 'Alpha-beta pruning']} />

      <div className="grid g-side">
        <div className="stack">
          <Card title="Predefined utility values" sub="Utility = −(value of breached assets + hardening cost). Hardened assets leak only a fraction of their value.">
            {assets.map((a) => <Slider key={a.id} label={a.name} unit="value" min={10} max={150} step={5} value={a.value} onChange={(v) => setVal(a.id, v)} />)}
            <Slider label="Cost to harden one asset" unit="" min={0} max={40} value={params.shieldCost} onChange={(shieldCost) => setParams({ ...params, shieldCost })} />
            <Slider label="Loss when hardened asset is hit" unit="" min={0} max={0.6} step={0.05} value={params.leak} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(leak) => setParams({ ...params, leak })} />
            <div className="field"><label>Rounds (defender then attacker)</label><Seg value={params.rounds} onChange={(rounds) => setParams({ ...params, rounds })} options={[[1, '1'], [2, '2'], [3, '3']]} /></div>
          </Card>
          <div className="grid g3" style={{ gap: 10 }}>
            <Stat k="Minimax value" v={res.value} s="defender utility" />
            <Stat k="Naive defender" v={naive} s="no hardening" />
            <Stat k="Nodes searched" v={res.nodes} s={ab === 'on' ? `of ${without.nodes} without α-β` : 'no pruning'} />
          </div>
        </div>

        <div className="stack">
          <Card title="Recommended defensive strategy" sub="Principal variation: the line of play when both sides are optimal.">
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {res.pv.map((n, i) => (
                <li key={i}><span className={`pl ${i % 2 === 0 ? 'd' : 'a'}`}>{i % 2 === 0 ? 'DEFENDER' : 'ATTACKER'}</span> {n.move.label} <span className="mono muted">→ value {n.value}</span></li>
              ))}
            </ol>
            <div style={{ marginTop: 14 }}>
              <Explain title="Reading the result">By following the optimal plan the defender limits expected utility to <b>{res.value}</b>, compared with <b>{naive}</b> if it never defends. The first move, <b>{res.pv[0].move.label}</b>, is chosen because every attacker reply was evaluated and the defender assumes the attacker picks the worst case for it.</Explain>
            </div>
          </Card>
          <Card title="Game tree" sub="Click nodes to expand. Highlighted nodes are the optimal line; numbers are minimax values." right={<Seg value={ab} onChange={setAb} options={[['on', 'Alpha-beta on'], ['off', 'Off']]} />}>
            <div className="tree scroll" style={{ maxHeight: 420 }}><ul><TreeNode node={res.root} depth={0} defaultOpen /></ul></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

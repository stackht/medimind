import { mf, human } from '../lib/fuzzy.js';

export const PALETTE = ['#0b7a8f', '#e08a1e', '#7b5cc9', '#c93a31', '#2f9e66', '#3a64c7'];

// Plots every fuzzy set of a variable, the crisp input marker, and optionally an aggregated output curve.
export function MembershipChart({ variable, value, height = 150, curve, crisp, title }) {
  const W = 440, H = height, pad = { l: 30, r: 10, t: 12, b: 26 };
  const [lo, hi] = variable.range;
  const sx = (x) => pad.l + ((x - lo) / (hi - lo)) * (W - pad.l - pad.r);
  const sy = (y) => pad.t + (1 - y) * (H - pad.t - pad.b);
  const sets = Object.entries(variable.sets);
  const pts = (s) => Array.from({ length: 121 }, (_, k) => {
    const x = lo + ((hi - lo) * k) / 120;
    return `${sx(x).toFixed(1)},${sy(mf(s, x)).toFixed(1)}`;
  }).join(' ');
  return (
    <figure style={{ margin: 0 }}>
      {title && <figcaption className="lbl" style={{ marginBottom: 2 }}>{title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Membership functions for ${variable.label}`}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(g)} y2={sy(g)} stroke="#e0e9ee" />
            <text x={pad.l - 6} y={sy(g) + 4} fontSize="10" textAnchor="end" fill="#7b909b">{g}</text>
          </g>
        ))}
        {sets.map(([name, s], i) => (
          <polyline key={name} points={pts(s)} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {curve && (
          <polygon
            points={`${sx(lo)},${sy(0)} ${curve.map((c) => `${sx(c.x).toFixed(1)},${sy(c.y).toFixed(1)}`).join(' ')} ${sx(hi)},${sy(0)}`}
            fill="#0b7a8f" fillOpacity="0.22" stroke="#0b7a8f" strokeWidth="1.5"
          />
        )}
        {value !== undefined && (
          <g>
            <line x1={sx(value)} x2={sx(value)} y1={pad.t} y2={H - pad.b} stroke="#12303b" strokeDasharray="4 3" />
            {sets.map(([name, s]) => {
              const m = mf(s, value);
              return m > 0.001 ? <circle key={name} cx={sx(value)} cy={sy(m)} r="4" fill="#fff" stroke="#12303b" strokeWidth="1.5" /> : null;
            })}
          </g>
        )}
        {crisp !== undefined && (
          <g>
            <line x1={sx(crisp)} x2={sx(crisp)} y1={pad.t} y2={H - pad.b} stroke="#c93a31" strokeWidth="2" />
            <text x={sx(crisp)} y={pad.t + 2} fontSize="10.5" fontWeight="700" fill="#c93a31" textAnchor={sx(crisp) > W - 80 ? 'end' : 'start'} dx={sx(crisp) > W - 80 ? -4 : 4}>
              centroid {crisp.toFixed(1)}
            </text>
          </g>
        )}
        {[lo, (lo + hi) / 2, hi].map((t) => (
          <text key={t} x={sx(t)} y={H - 8} fontSize="10" textAnchor="middle" fill="#7b909b">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
        ))}
      </svg>
      <div className="legend" style={{ marginTop: 2 }}>
        {sets.map(([name], i) => <span key={name}><i className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />{human(name)}</span>)}
      </div>
    </figure>
  );
}

export function LineChart({ series, height = 170, yLabel = '', xLabel = 'epoch' }) {
  const W = 440, H = height, pad = { l: 40, r: 10, t: 10, b: 26 };
  const all = series.flatMap((s) => s.data);
  const n = Math.max(...series.map((s) => s.data.length));
  const max = Math.max(...all, 1e-6) * 1.05, min = Math.min(0, ...all);
  const sx = (i) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const sy = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${yLabel} over ${xLabel}`}>
        {[0, 0.5, 1].map((g) => {
          const v = min + (max - min) * g;
          return (
            <g key={g}>
              <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke="#e0e9ee" />
              <text x={pad.l - 6} y={sy(v) + 4} fontSize="10" textAnchor="end" fill="#7b909b">{v.toFixed(2)}</text>
            </g>
          );
        })}
        {series.map((s, k) => (
          <polyline key={s.name} fill="none" stroke={s.color || PALETTE[k]} strokeWidth="2" strokeLinejoin="round"
            points={s.data.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')} />
        ))}
        <text x={W / 2} y={H - 6} fontSize="10.5" textAnchor="middle" fill="#7b909b">{xLabel}</text>
      </svg>
      <div className="legend">{series.map((s, k) => <span key={s.name}><i className="dot" style={{ background: s.color || PALETTE[k] }} />{s.name}</span>)}</div>
    </div>
  );
}

// 2-D scatter on a 0-10 domain with optional decision line and prototype markers.
export function Scatter({ points, line, protos, onClick, xLabel, yLabel, size = 440 }) {
  const W = size, H = size * 0.82, pad = { l: 36, r: 12, t: 12, b: 34 };
  const sx = (x) => pad.l + (x / 10) * (W - pad.l - pad.r);
  const sy = (y) => pad.t + (1 - y / 10) * (H - pad.t - pad.b);
  let seg = null;
  if (line) {
    const [w0, w1] = line.w;
    const pts = [];
    for (const x of [0, 10]) { const y = -(w0 * x + line.b) / (w1 || 1e-9); if (y >= 0 && y <= 10) pts.push([x, y]); }
    for (const y of [0, 10]) { const x = -(w1 * y + line.b) / (w0 || 1e-9); if (x >= 0 && x <= 10) pts.push([x, y]); }
    if (pts.length >= 2) seg = [pts[0], pts[pts.length - 1]];
  }
  const handle = (e) => {
    if (!onClick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    const x = ((px - pad.l) / (W - pad.l - pad.r)) * 10, y = (1 - (py - pad.t) / (H - pad.t - pad.b)) * 10;
    if (x >= 0 && x <= 10 && y >= 0 && y <= 10) onClick(x, y);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" onClick={handle} style={{ cursor: onClick ? 'crosshair' : 'default' }} role="img" aria-label="Scatter plot of patient records">
      <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="#f7fafb" stroke="#e0e9ee" />
      {[0, 2.5, 5, 7.5, 10].map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={pad.t} y2={H - pad.b} stroke="#eef3f6" />
          <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="#eef3f6" />
          <text x={sx(t)} y={H - pad.b + 14} fontSize="10" textAnchor="middle" fill="#7b909b">{t}</text>
          <text x={pad.l - 6} y={sy(t) + 4} fontSize="10" textAnchor="end" fill="#7b909b">{t}</text>
        </g>
      ))}
      {seg && <line x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} stroke="#12303b" strokeWidth="2" strokeDasharray="6 4" />}
      {points.map((p, i) => (
        p.shape === 'square'
          ? <rect key={i} x={sx(p.x) - 4.5} y={sy(p.y) - 4.5} width="9" height="9" fill={p.color} fillOpacity="0.85" stroke={p.stroke || '#fff'} strokeWidth="1.2" />
          : <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill={p.color} fillOpacity="0.85" stroke={p.stroke || '#fff'} strokeWidth="1.2" />
      ))}
      {protos?.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r="11" fill="none" stroke={p.color} strokeWidth="3" />
          <circle cx={sx(p.x)} cy={sy(p.y)} r="3" fill={p.color} />
        </g>
      ))}
      <text x={(W + pad.l) / 2} y={H - 4} fontSize="11" textAnchor="middle" fill="#4a6572">{xLabel}</text>
      <text transform={`translate(10 ${H / 2}) rotate(-90)`} fontSize="11" textAnchor="middle" fill="#4a6572">{yLabel}</text>
    </svg>
  );
}

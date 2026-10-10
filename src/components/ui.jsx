import { useEffect, useRef, useState } from 'react';

export function PageHeader({ ps, title, desc, tags = [] }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      <p>{desc}</p>
      <div className="page-meta">{ps.split('·')[0].trim()} · {tags.join(', ')}</div>
    </header>
  );
}

export const Card = ({ title, sub, children, className = '', right }) => (
  <section className={`card ${className}`}>
    {(title || right) && (
      <div className="row spread">
        <div className="card-title">{title}</div>
        {right}
      </div>
    )}
    {sub && <div className="card-sub">{sub}</div>}
    {children}
  </section>
);

export const Badge = ({ level, children }) => <span className={`badge b-${level}`}>{children ?? level}</span>;

export const Stat = ({ k, v, s }) => (
  <div className="stat"><div className="k">{k}</div><div className="v">{v}</div>{s && <div className="s">{s}</div>}</div>
);

export const Explain = ({ title = 'How it works', children }) => (
  <div className="explain"><strong>{title}: </strong>{children}</div>
);

export function Slider({ label, unit, value, min, max, step = 1, onChange, fmt }) {
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        <span className="val">{fmt ? fmt(value) : value} {unit}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([v, l]) => (
        <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)} role="tab" aria-selected={value === v}>{l}</button>
      ))}
    </div>
  );
}

export const Code = ({ children }) => <pre className="code">{children}</pre>;

// Step-through player used by the search algorithms and training animations.
export function usePlayer(length, speed = 650) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef();
  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setI((v) => {
        if (v >= length - 1) { setPlaying(false); return v; }
        return v + 1;
      });
    }, speed);
    return () => clearInterval(timer.current);
  }, [playing, length, speed]);
  return {
    i: Math.min(i, Math.max(0, length - 1)),
    playing,
    play: () => { setI((v) => (v >= length - 1 ? 0 : v)); setPlaying(true); },
    pause: () => setPlaying(false),
    set: (v) => { setPlaying(false); setI(v); },
    reset: () => { setPlaying(false); setI(0); },
    last: () => { setPlaying(false); setI(length - 1); },
  };
}

export function PlayerBar({ player, length, label = 'Step' }) {
  return (
    <div className="row">
      <button className="btn sm primary" onClick={player.playing ? player.pause : player.play}>{player.playing ? 'Pause' : 'Play'}</button>
      <button className="btn sm" onClick={() => player.set(Math.max(0, player.i - 1))}>Back</button>
      <button className="btn sm" onClick={() => player.set(Math.min(length - 1, player.i + 1))}>Next</button>
      <button className="btn sm" onClick={player.reset}>Reset</button>
      <button className="btn sm" onClick={player.last}>Skip to end</button>
      <span className="muted note">{label} {Math.min(player.i + 1, length)} / {length}</span>
    </div>
  );
}

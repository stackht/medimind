import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Icon from './components/Icon.jsx';
import { useSim } from './context/SimContext.jsx';
import { useToast } from './components/feedback.jsx';
import { EXPERIMENTS } from './experiments.jsx';
import { PRIORITY_LABEL, clockLabel } from './lib/simData.js';
import { getSidebarCollapsed, setSidebarCollapsed, setReduceMotion, useReduceMotion } from './lib/prefs.js';
import { NAV } from './nav.js';
import Overview from './pages/Overview.jsx';
import Patients from './pages/Patients.jsx';
import TriagePage from './pages/TriagePage.jsx';
import ResourcesPage from './pages/ResourcesPage.jsx';
import Routing from './pages/Routing.jsx';
import Monitoring from './pages/Monitoring.jsx';
import Analytics from './pages/Analytics.jsx';
import ExperimentsIndex, { ExperimentPage } from './pages/Experiments.jsx';
import Reports from './pages/Reports.jsx';

function useOutside(ref, onOut, active) {
  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    const k = (e) => { if (e.key === 'Escape') onOut(); };
    document.addEventListener('pointerdown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('pointerdown', h); document.removeEventListener('keydown', k); };
  }, [ref, onOut, active]);
}

function GlobalSearch() {
  const { snap } = useSim();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const ref = useRef();
  useOutside(ref, () => setOpen(false), open);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const pages = NAV.filter((n) => n.name.toLowerCase().includes(t)).map((n) => ({ kind: 'Pages', label: n.name, sub: '', go: () => navigate(n.path) }));
    const exps = EXPERIMENTS.filter((e) => `${e.title} ${e.technique}`.toLowerCase().includes(t)).slice(0, 4)
      .map((e) => ({ kind: 'Experiments', label: e.short, sub: e.technique, go: () => navigate(`/experiments/${e.slug}`) }));
    const pts = snap.patients.filter((p) => p.status !== 'triage' && `${p.id} ${p.dept} ${p.priority} ${p.status}`.toLowerCase().includes(t)).slice(-6).reverse()
      .map((p) => ({ kind: 'Patients', label: `${p.id} · ${p.dept}`, sub: `${PRIORITY_LABEL[p.priority]} · ${p.status}`, go: () => navigate('/patients', { state: { openId: p.id } }) }));
    return [...pts, ...pages, ...exps];
  }, [q, snap.patients, navigate]);

  const choose = (r) => { r.go(); setOpen(false); setQ(''); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === 'Enter' && results[sel]) choose(results[sel]);
  };
  let lastKind = '';
  return (
    <div className="search" ref={ref} role="search">
      <Icon name="search" size={16} />
      <input value={q} placeholder="Search patients, pages…" aria-label="Global search" onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(0); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
      {open && q.trim() && (
        <div className="menu menu-list" role="listbox">
          {results.length === 0 && <div className="menu-empty">No matches for “{q}”.</div>}
          {results.map((r, i) => {
            const head = r.kind !== lastKind ? <div className="menu-sec" key={`h${r.kind}`}>{r.kind}</div> : null;
            lastKind = r.kind;
            return (
              <div key={`${r.kind}${r.label}`}>
                {head}
                <button className={`menu-item ${i === sel ? 'sel' : ''}`} role="option" aria-selected={i === sel} onClick={() => choose(r)} onMouseEnter={() => setSel(i)}>
                  <div><div style={{ fontWeight: 600 }}>{r.label}</div>{r.sub && <div className="note">{r.sub}</div>}</div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { snap, sim } = useSim();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useOutside(ref, () => setOpen(false), open);
  const list = [...snap.alerts].reverse().slice(0, 10);
  const unread = snap.d.unread;
  const go = (a) => {
    sim.acknowledge(a.id);
    setOpen(false);
    if (/corridor|route/i.test(a.title)) navigate('/routing');
    else if (a.patientId) navigate('/patients', { state: { openId: a.patientId } });
    else navigate('/routing');
  };
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="bell" />{unread > 0 && <span className="dot-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="menu" role="dialog" aria-label="Notifications" style={{ width: 360 }}>
          <div className="menu-head">Notifications<button className="btn sm" onClick={() => sim.markAlertsRead()} disabled={!unread}>Mark all read</button></div>
          <div className="menu-list">
            {list.length === 0 && <div className="menu-empty">No alerts yet. Trigger an emergency to see one.</div>}
            {list.map((a) => (
              <button key={a.id} className="menu-item" onClick={() => go(a)} style={{ opacity: a.read ? 0.65 : 1 }}>
                <Icon name={a.level === 'emergency' ? 'siren' : 'alert'} size={17} style={{ color: a.level === 'emergency' ? 'var(--bad)' : 'var(--warn)', marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{a.title}{!a.read && <span className="dot" style={{ background: 'var(--teal)', width: 7, height: 7, marginLeft: 6 }} />}</div>
                  <div className="note">{a.text}</div>
                  <div className="note mono">{clockLabel(a.t)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ onAbout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const reduce = useReduceMotion();
  useOutside(ref, () => setOpen(false), open);
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="avatar" aria-label="Profile and settings" aria-expanded={open} onClick={() => setOpen(!open)}>DA</button>
      {open && (
        <div className="menu" style={{ minWidth: 240 }}>
          <div className="menu-head"><span>Demo administrator<div className="note" style={{ fontWeight: 400 }}>Synthetic data only</div></span></div>
          <Link to="/reports" className="menu-item" onClick={() => setOpen(false)}><Icon name="settings" size={16} />Reports &amp; settings</Link>
          <button className="menu-item" onClick={() => setReduceMotion(!reduce)} role="menuitemcheckbox" aria-checked={reduce}><Icon name={reduce ? 'check' : 'eye'} size={16} />Reduce motion {reduce ? '(on)' : '(off)'}</button>
          <button className="menu-item" onClick={() => { setOpen(false); onAbout(); }}><Icon name="info" size={16} />About this demo</button>
        </div>
      )}
    </div>
  );
}

function Topbar({ onMenu, onAbout }) {
  const { snap, sim } = useSim();
  const loc = useLocation();
  const exp = EXPERIMENTS.find((e) => loc.pathname === `/experiments/${e.slug}`);
  const page = NAV.find((n) => (n.end ? loc.pathname === n.path : loc.pathname.startsWith(n.path))) ?? NAV[0];
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open navigation"><Icon name="menu" /></button>
      <div className="crumbs">
        <div className="trail"><Link to="/">MediMind</Link><Icon name="chevron" size={12} />{exp ? <Link to="/experiments">AI Experiments</Link> : page.name}{exp && <><Icon name="chevron" size={12} />{exp.short}</>}</div>
        <h2>{exp ? exp.short : page.title}</h2>
      </div>
      <span className="top-spacer" />
      <GlobalSearch />
      <div className={`sim-pill ${snap.running ? 'running' : ''}`} role="status" aria-label={`Simulation ${snap.running ? 'running' : 'paused'}`}>
        <span className="led" /><span className="pill-txt">{snap.running ? 'Running' : 'Paused'}</span><span className="clock-wrap"><span className="clock"> {snap.clock}</span></span>
        <button onClick={() => (snap.running ? sim.pause() : sim.start())} aria-label={snap.running ? 'Pause simulation' : 'Start simulation'} disabled={!snap.ready}><Icon name={snap.running ? 'pause' : 'play'} size={13} /></button>
      </div>
      <Notifications />
      <ProfileMenu onAbout={onAbout} />
    </header>
  );
}

export default function App() {
  const { snap, d } = useSim();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(getSidebarCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [about, setAbout] = useState(false);
  const loc = useLocation();
  const seen = useRef(0);

  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { setSidebarCollapsed(collapsed); }, [collapsed]);
  useEffect(() => {
    const latest = snap.alerts[snap.alerts.length - 1];
    if (!latest) { seen.current = 0; return; }
    if (latest.id > seen.current) {
      if (seen.current !== 0 && latest.level === 'emergency') toast(`${latest.title}: ${latest.text}`, 'error');
      seen.current = latest.id;
    }
  }, [snap.alerts, toast]);

  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sb ${drawer ? 'open' : ''}`} aria-label="Primary navigation">
        <Link to="/" className="sb-brand">
          <span className="sb-mark"><Icon name="cross" size={19} /></span>
          <span><div className="sb-name">MediMind</div><div className="sb-sub">Smart Hospital Assistant</div></span>
        </Link>
        <nav>
          {groups.map((g) => (
            <div key={g}>
              <div className="sb-group">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => (
                <NavLink key={n.path} to={n.path} end={n.end} className="sb-link" title={collapsed ? n.name : undefined}>
                  <Icon name={n.icon} /><span className="sb-label">{n.name}</span>
                  {n.badge === 'emergencies' && d.activeEmergencies.length > 0 && <span className="count">{d.activeEmergencies.length}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sb-foot">
          <button className="sb-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name={collapsed ? 'chevron' : 'chevleft'} /><span className="sb-label">Collapse</span>
          </button>
        </div>
      </aside>
      <div className={`scrim ${drawer ? 'open' : ''}`} onClick={() => setDrawer(false)} />
      <div className="main">
        <Topbar onMenu={() => setDrawer(true)} onAbout={() => setAbout(true)} />
        <main className="page">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/triage" element={<TriagePage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/routing" element={<Routing />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/experiments" element={<ExperimentsIndex />} />
            <Route path="/experiments/:slug" element={<ExperimentPage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<div className="empty"><b>Page not found</b><Link to="/">Back to overview</Link></div>} />
          </Routes>
          <p className="disclaimer">MediMind is an educational simulation. All patients, vitals, datasets and recommendations are synthetic and illustrative. It is not medical advice and must not be used for clinical decisions.</p>
        </main>
      </div>
      {about && (
        <div className="overlay" onClick={() => setAbout(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="About MediMind" onClick={(e) => e.stopPropagation()}>
            <h3>About MediMind</h3>
            <p>An educational, frontend-only simulation of a hospital operations dashboard. Every patient is synthetic, the simulation is seeded and reproducible, and nothing is connected to a real hospital. The AI methods (Prolog, A*, fuzzy logic, neuro-fuzzy, Minimax, perceptron, competitive learning, n-gram models) are implemented in this project.</p>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn primary" onClick={() => setAbout(false)} autoFocus>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

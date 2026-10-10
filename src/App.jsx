import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { usePatient } from './context/PatientContext.jsx';
import { SCENARIOS } from './lib/patients.js';
import Dashboard from './modules/Dashboard.jsx';
import Triage from './modules/Triage.jsx';
import Vitals from './modules/Vitals.jsx';
import Risk from './modules/Risk.jsx';
import Resources from './modules/Resources.jsx';
import Navigation from './modules/Navigation.jsx';
import Emergency from './modules/Emergency.jsx';
import Room from './modules/Room.jsx';
import Security from './modules/Security.jsx';
import Insights from './modules/Insights.jsx';
import Messages from './modules/Messages.jsx';

export const MODULES = [
  { group: 'Care pathway', path: '/triage', ps: 'PS 2', name: 'Priority Triage', el: <Triage /> },
  { group: 'Care pathway', path: '/vitals', ps: 'PS 6', name: 'Vitals Monitor', el: <Vitals /> },
  { group: 'Care pathway', path: '/risk', ps: 'PS 8', name: 'Risk Estimator', el: <Risk /> },
  { group: 'Care pathway', path: '/resources', ps: 'PS 3', name: 'Resource Manager', el: <Resources /> },
  { group: 'Movement', path: '/navigate', ps: 'PS 1', name: 'Patient Navigation', el: <Navigation /> },
  { group: 'Movement', path: '/emergency', ps: 'PS 4', name: 'Emergency Router', el: <Emergency /> },
  { group: 'Facility', path: '/room', ps: 'PS 7', name: 'Smart Room', el: <Room /> },
  { group: 'Facility', path: '/security', ps: 'PS 5', name: 'Security Ops', el: <Security /> },
  { group: 'Data & language', path: '/insights', ps: 'PS 9', name: 'Patient Insights', el: <Insights /> },
  { group: 'Data & language', path: '/messages', ps: 'PS 10', name: 'Health Messages', el: <Messages /> },
];

const Logo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>
);

export default function App() {
  const { patient, load } = usePatient();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const groups = [...new Set(MODULES.map((m) => m.group))];

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Logo /></div>
          <div><div className="brand-name">MediMind</div><div className="brand-sub">Smart Hospital Assistant</div></div>
        </div>
        <NavLink to="/" end className="nav-link">Overview &amp; journey</NavLink>
        {groups.map((g) => (
          <div key={g}>
            <div className="nav-group">{g}</div>
            {MODULES.filter((m) => m.group === g).map((m) => (
              <NavLink key={m.path} to={m.path} className="nav-link">{m.name}<span className="nav-ps">{m.ps}</span></NavLink>
            ))}
          </div>
        ))}
        <div className="side-foot">Frontend-only demo. All patients and data are simulated; not for clinical use.</div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="btn sm menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle navigation">Menu</button>
          <div className="patient-chip" title="The simulated patient shared across all modules">
            <span className="avatar">{patient.name.split(' ').map((w) => w[0]).join('')}</span>
            <span><b>{patient.name}</b> · {patient.age}y · {patient.sex}</span>
          </div>
          <label className="row note" style={{ marginLeft: 'auto' }}>
            Simulated patient
            <select value={SCENARIOS.find((s) => s.name === patient.name)?.key ?? ''} onChange={(e) => load(e.target.value)} aria-label="Choose simulated patient">
              {SCENARIOS.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
            </select>
          </label>
        </div>
        <main className="page">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {MODULES.map((m) => <Route key={m.path} path={m.path} element={m.el} />)}
          </Routes>
          <p className="disclaimer">MediMind is an academic AI demonstration. Every patient, vital sign, dataset and recommendation is synthetic and illustrative only. It is not medical advice and must not be used for clinical decisions.</p>
        </main>
      </div>
    </div>
  );
}

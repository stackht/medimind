import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useSim } from '../context/SimContext.jsx';
import { PatientDrawer, PriorityBadge, SimControls, STATUS_LABEL, StatusBadge, waitOf } from '../components/dash.jsx';
import { useToast } from '../components/feedback.jsx';
import { DEPARTMENTS, PRIORITIES, PRIORITY_LABEL, PRIORITY_RANK, clockLabel } from '../lib/simData.js';

const PAGE = 10;
const COLS = [
  ['id', 'Patient ID'], ['dept', 'Department'], ['arrival', 'Arrival time'], ['priority', 'Priority'], ['wait', 'Waiting'], ['status', 'Status'],
];
const STATUS_ORDER = { triage: 0, waiting: 1, treating: 2, discharged: 3 };

export default function Patients() {
  const { snap, sim } = useSim();
  const toast = useToast();
  const loc = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [prio, setPrio] = useState('all');
  const [status, setStatus] = useState('active');
  const [dept, setDept] = useState('all');
  const [sort, setSort] = useState({ key: 'priority', dir: 1 });
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (loc.state?.openId) { setOpenId(loc.state.openId); setStatus('all'); navigate('/patients', { replace: true, state: null }); }
  }, [loc.state, navigate]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = snap.patients.filter((p) => {
      if (t && !`${p.id} ${p.dept} ${p.symptoms.join(' ')}`.toLowerCase().includes(t)) return false;
      if (prio !== 'all' && p.priority !== prio) return false;
      if (dept !== 'all' && p.dept !== dept) return false;
      if (status === 'active') return p.status !== 'discharged';
      return status === 'all' || p.status === status;
    });
    const val = {
      id: (p) => p.id, dept: (p) => p.dept, arrival: (p) => p.arrivalTick, priority: (p) => PRIORITY_RANK[p.priority],
      wait: (p) => waitOf(p, snap.tick), status: (p) => STATUS_ORDER[p.status],
    }[sort.key];
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : a.arrivalTick - b.arrivalTick) * sort.dir);
  }, [snap.patients, snap.tick, q, prio, dept, status, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  const clear = () => { setQ(''); setPrio('all'); setDept('all'); setStatus('active'); setPage(0); };
  const filtered = q || prio !== 'all' || dept !== 'all' || status !== 'active';

  return (
    <div>
      <div className="page-title-row">
        <div><h1>Patient management</h1><p>All synthetic patients in the simulation. Click a row for the triage explanation, vitals, resources and timeline.</p></div>
      </div>
      <SimControls compact />
      <div className="card flush">
        <div className="filters">
          <div className="search"><Icon name="search" size={15} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search ID, department, symptom" aria-label="Search patients" /></div>
          <select className="input-sm" value={prio} onChange={(e) => { setPrio(e.target.value); setPage(0); }} aria-label="Filter by priority">
            <option value="all">All priorities</option>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
          <select className="input-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Filter by status">
            <option value="active">Active patients</option><option value="all">All statuses</option>
            {['waiting', 'treating', 'discharged'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className="input-sm" value={dept} onChange={(e) => { setDept(e.target.value); setPage(0); }} aria-label="Filter by department">
            <option value="all">All departments</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {filtered && <button className="btn sm" onClick={clear}>Clear filters</button>}
          <span className="note" style={{ marginLeft: 'auto' }}>{rows.length} patient{rows.length === 1 ? '' : 's'}</span>
        </div>
        {slice.length === 0 ? (
          <div style={{ padding: 20 }}><div className="empty"><b>{snap.patients.length ? 'No patients match these filters' : 'No patients yet'}</b>{snap.patients.length ? 'Try clearing the filters.' : 'Start the simulation or add a patient.'}</div></div>
        ) : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>
              {COLS.map(([k, n]) => (
                <th key={k} className="sortable" onClick={() => sortBy(k)} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  {n}{sort.key === k && <Icon name={sort.dir === 1 ? 'arrowUp' : 'arrowDown'} size={11} style={{ marginLeft: 4, verticalAlign: '-1px' }} />}
                </th>
              ))}
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {slice.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setOpenId(p.id)}>
                  <td><b>{p.id}</b></td><td>{p.dept}</td><td className="mono">{clockLabel(p.arrivalTick)}</td>
                  <td><PriorityBadge level={p.priority} /></td>
                  <td className="mono">{waitOf(p, snap.tick)} min</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row nowrap" style={{ gap: 6 }}>
                      <button className="btn sm" onClick={() => setOpenId(p.id)}>View</button>
                      {p.status !== 'discharged' && p.status !== 'triage' && p.priority !== 'emergency' && <button className="btn sm alert" onClick={() => { sim.setPriority(p.id, 'emergency'); toast(`${p.id} escalated to Emergency`, 'error'); }}>Escalate</button>}
                      {p.status === 'treating' && <button className="btn sm" onClick={() => { sim.discharge(p.id); toast(`${p.id} discharged`); }}>Discharge</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div className="pager">
          <span>Page {cur + 1} of {pages}</span>
          <div className="row"><button className="btn sm" onClick={() => setPage(cur - 1)} disabled={cur === 0}>Previous</button><button className="btn sm" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1}>Next</button></div>
        </div>
      </div>
      {openId && <PatientDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

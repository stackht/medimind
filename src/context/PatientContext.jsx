import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { SCENARIOS } from '../lib/patients.js';

const Ctx = createContext(null);
export const usePatient = () => useContext(Ctx);

export function PatientProvider({ children }) {
  const [patient, setPatient] = useState(SCENARIOS[0]);
  const update = useCallback((patch) => setPatient((p) => ({ ...p, ...patch })), []);
  const load = useCallback((key) => setPatient(SCENARIOS.find((s) => s.key === key)), []);
  const value = useMemo(() => ({ patient, update, load }), [patient, update, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

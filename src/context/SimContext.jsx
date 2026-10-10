import { useSyncExternalStore } from 'react';
import { Simulation } from '../lib/sim.js';

// One simulation instance for the whole app. Every page reads the same snapshot.
export const sim = new Simulation();

export function useSim() {
  const snap = useSyncExternalStore(sim.subscribe, sim.getSnapshot);
  return { snap, d: snap.d, sim };
}

import { useSyncExternalStore } from 'react';

// Small persisted UI preferences. Every storage call is wrapped for private-mode browsers.
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export const getReduceMotion = () => read('mm-reduce-motion') === '1';
export function setReduceMotion(on) {
  write('mm-reduce-motion', on ? '1' : '0');
  document.documentElement.classList.toggle('reduce-motion', on);
  window.dispatchEvent(new Event('mm-prefs'));
}
export function useReduceMotion() {
  return useSyncExternalStore((cb) => { window.addEventListener('mm-prefs', cb); return () => window.removeEventListener('mm-prefs', cb); }, getReduceMotion);
}
export const getSidebarCollapsed = () => read('mm-sidebar') === 'collapsed';
export const setSidebarCollapsed = (on) => write('mm-sidebar', on ? 'collapsed' : 'open');

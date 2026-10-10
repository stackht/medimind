// Primary navigation. `badge: 'emergencies'` shows the live count of active emergencies.
export const NAV = [
  { group: 'Operations', path: '/', end: true, icon: 'dashboard', name: 'Overview', title: 'Overview' },
  { group: 'Operations', path: '/patients', icon: 'users', name: 'Patient Management', title: 'Patient Management' },
  { group: 'Operations', path: '/triage', icon: 'clipboard', name: 'Patient Triage', title: 'Patient Triage' },
  { group: 'Operations', path: '/resources', icon: 'bed', name: 'Hospital Resources', title: 'Hospital Resources' },
  { group: 'Operations', path: '/routing', icon: 'route', name: 'Emergency Routing', title: 'Emergency Routing', badge: 'emergencies' },
  { group: 'Operations', path: '/monitoring', icon: 'pulse', name: 'Patient Monitoring', title: 'Patient Monitoring' },
  { group: 'Operations', path: '/analytics', icon: 'chart', name: 'Traffic & Queue Analytics', title: 'Traffic & Queue Analytics' },
  { group: 'Intelligence', path: '/experiments', icon: 'flask', name: 'AI Experiments', title: 'AI Experiments' },
  { group: 'System', path: '/reports', icon: 'file', name: 'Reports & Settings', title: 'Reports & Settings' },
];

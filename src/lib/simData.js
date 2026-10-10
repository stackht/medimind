// Synthetic patient generator for the educational simulation. Nothing here is real patient data.
export const DEPT_BY_CONDITION = {
  cardiac: 'Cardiology', respiratory: 'Pulmonology', trauma: 'Orthopaedics',
  neuro: 'Neurology', paediatric: 'Paediatrics', general: 'General Medicine',
};
export const SPECIALTY_BY_DEPT = {
  Cardiology: 'cardiology', Pulmonology: 'pulmonology', Orthopaedics: 'orthopaedics',
  Neurology: 'neurology', Paediatrics: 'paediatrics', 'General Medicine': 'general_medicine',
};
export const DEPARTMENTS = Object.keys(SPECIALTY_BY_DEPT);

// repeated entries raise the chance of a symptom
const POOLS = {
  cardiac: ['chest_pain', 'dizziness', 'dizziness', 'fatigue', 'fatigue', 'fatigue', 'headache', 'headache', 'cough', 'cough', 'cough', 'runny_nose'],
  respiratory: ['cough', 'cough', 'cough', 'cough', 'high_fever', 'fatigue', 'sore_throat', 'sore_throat', 'runny_nose', 'runny_nose', 'headache', 'breathing_difficulty'],
  trauma: ['suspected_fracture', 'suspected_fracture', 'suspected_fracture', 'abdominal_pain', 'headache', 'headache', 'fatigue', 'rash', 'rash', 'severe_bleeding'],
  neuro: ['headache', 'headache', 'headache', 'headache', 'dizziness', 'fatigue', 'fatigue', 'rash', 'sore_throat', 'seizure'],
  paediatric: ['high_fever', 'cough', 'cough', 'rash', 'rash', 'runny_nose', 'runny_nose', 'sore_throat', 'dehydration', 'fatigue'],
  general: ['headache', 'sore_throat', 'cough', 'runny_nose', 'rash', 'rash', 'abdominal_pain', 'fatigue', 'fatigue', 'headache', 'runny_nose'],
};
const WEIGHTS = [['general', 0.3], ['paediatric', 0.17], ['respiratory', 0.15], ['cardiac', 0.14], ['trauma', 0.12], ['neuro', 0.12]];
const DIAG = {
  cardiac: ['lab', 'lab', 'none'], respiratory: ['xray', 'xray', 'none'], trauma: ['xray', 'ct', 'ct'],
  neuro: ['ct', 'mri', 'ct'], paediatric: ['lab', 'none', 'none'], general: ['none', 'none', 'lab'],
};

const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const between = (rnd, a, b) => Math.round(a + rnd() * (b - a));

export function pickCondition(rnd) {
  let r = rnd();
  for (const [c, w] of WEIGHTS) { r -= w; if (r <= 0) return c; }
  return 'general';
}

export function generatePatient(rnd, { condition, forceSymptoms } = {}) {
  const cond = condition ?? pickCondition(rnd);
  const pool = POOLS[cond];
  const n = rnd() < 0.6 ? 1 : rnd() < 0.75 ? 2 : 3;
  const symptoms = forceSymptoms ? [...forceSymptoms] : [];
  while (symptoms.length < n) { const s = pick(rnd, pool); if (!symptoms.includes(s)) symptoms.push(s); }
  const age = cond === 'paediatric' ? between(rnd, 3, 14) : cond === 'cardiac' ? between(rnd, 38, 72) : between(rnd, 18, 70);
  const febrile = symptoms.includes('high_fever');
  return {
    age, sex: rnd() < 0.5 ? 'F' : 'M', condition: cond, symptoms,
    pain: between(rnd, symptoms.includes('chest_pain') || symptoms.includes('severe_bleeding') ? 6 : 1, symptoms.includes('suspected_fracture') ? 8 : 5),
    temp: Math.round((febrile ? 38.6 + rnd() * 1.4 : 36.4 + rnd() * 1.1) * 10) / 10,
    heartRate: cond === 'cardiac' ? between(rnd, 82, 135) : cond === 'paediatric' ? between(rnd, 95, 150) : between(rnd, 62, 112),
    sys: cond === 'cardiac' ? between(rnd, 125, 185) : between(rnd, 100, 150),
    bmi: between(rnd, 18, 36), glucose: between(rnd, 80, 190),
    diag: pick(rnd, DIAG[cond]),
  };
}

export const EMERGENCY_SCENARIOS = [
  { condition: 'cardiac', forceSymptoms: ['chest_pain', 'breathing_difficulty'], title: 'Cardiac emergency' },
  { condition: 'trauma', forceSymptoms: ['severe_bleeding', 'suspected_fracture'], title: 'Trauma (road accident)' },
  { condition: 'neuro', forceSymptoms: ['stroke_signs', 'dizziness'], title: 'Suspected stroke' },
  { condition: 'respiratory', forceSymptoms: ['breathing_difficulty', 'high_fever'], title: 'Respiratory distress' },
];

export const PRIORITIES = ['routine', 'moderate', 'high', 'emergency'];
export const PRIORITY_LABEL = { routine: 'Routine', moderate: 'Moderate', high: 'High', emergency: 'Emergency' };
export const PRIORITY_RANK = { emergency: 0, high: 1, moderate: 2, routine: 3 };
// treatment length in simulated minutes
export const TREATMENT_TICKS = { routine: 18, moderate: 30, high: 45, emergency: 60 };

// Prolog gives low / medium / high. A "high" caused by a severe symptom is treated as an emergency.
export function toPriority(prolog) {
  if (prolog.priority === 'high') return prolog.reasons.some((r) => r.startsWith('severe_symptom')) ? 'emergency' : 'high';
  return prolog.priority === 'medium' ? 'moderate' : 'routine';
}

export const clockLabel = (tick) => {
  const m = 8 * 60 + tick;
  const hh = String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0');
  const mm = String(((m % 60) + 60) % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

// Plain-language version of a Prolog priority_reason(...) term, e.g. "severe_symptom(chest_pain)".
export function explainReason(r) {
  const m = r.match(/^(\w+)(?:\((.*)\))?$/);
  if (!m) return r;
  const [, name, arg = ''] = m;
  const a = arg.replace(/_/g, ' ');
  switch (name) {
    case 'severe_symptom': return `Severe symptom reported: ${a}`;
    case 'extreme_pain': return `Extreme pain (${arg}/10)`;
    case 'vulnerable_and_moderate': return `Patient under 5 or over 65 with ${a}`;
    case 'dangerous_temperature': return `Dangerously high temperature (${arg} °C)`;
    case 'moderate_symptom': return `Moderate symptom: ${a}`;
    case 'notable_pain': return `Notable pain (${arg}/10)`;
    case 'vulnerable_patient': return 'Patient under 5 or over 65';
    case 'fever': return `Fever (${arg} °C)`;
    case 'several_mild_symptoms': return `${arg} mild symptoms together`;
    case 'mild_symptom': return `Mild symptom: ${a}`;
    default: return r;
  }
}

// Display names for resource ids and types: icu_1 -> "ICU 1", dr_general_medicine_2 -> "Dr general medicine 2".
const ACR = { icu: 'ICU', hdu: 'HDU', ct: 'CT', mri: 'MRI', xray: 'X-ray' };
export const resName = (id) => {
  const s = String(id).split('_').map((w) => ACR[w] ?? (w === 'dr' ? 'Dr' : w)).join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

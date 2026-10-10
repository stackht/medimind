import { buildAdjacency } from './graph.js';
import { astar, bfs } from './search.js';
import { classifyPatient, allocateAll } from './prolog.js';
import { infer, VITALS_SYSTEM } from './fuzzy.js';
import { getTrainedModel, scoreRisk, riskCategory } from './anfis.js';

export const SCENARIOS = [
  { key: 'chest', title: 'Chest pain (elderly)', name: 'Ramesh Iyer', age: 68, sex: 'M', symptoms: ['chest_pain', 'dizziness'], pain: 8, temp: 37.1, heartRate: 128, sys: 165, bmi: 29, glucose: 150, condition: 'cardiac', diag: 'lab' },
  { key: 'child', title: 'Child with fever', name: 'Aanya Mehta', age: 3, sex: 'F', symptoms: ['high_fever', 'cough'], pain: 3, temp: 39.4, heartRate: 150, sys: 92, bmi: 16, glucose: 85, condition: 'paediatric', diag: 'lab' },
  { key: 'cold', title: 'Mild cold', name: 'Neha Kulkarni', age: 29, sex: 'F', symptoms: ['cough', 'sore_throat', 'runny_nose'], pain: 2, temp: 37.4, heartRate: 78, sys: 118, bmi: 24, glucose: 92, condition: 'general', diag: 'none' },
  { key: 'accident', title: 'Road accident', name: 'Arjun Verma', age: 34, sex: 'M', symptoms: ['severe_bleeding', 'suspected_fracture'], pain: 9, temp: 36.6, heartRate: 118, sys: 100, bmi: 26, glucose: 110, condition: 'trauma', diag: 'ct' },
];

export const CONDITIONS = ['cardiac', 'respiratory', 'trauma', 'neuro', 'paediatric', 'general'];
export const DIAGS = ['none', 'xray', 'ct', 'mri', 'lab'];

export function destinationFor(patient, priority) {
  const high = priority === 'high';
  const map = {
    cardiac: high ? 'icu' : 'cardio', paediatric: 'peds', trauma: high ? 'ot' : 'radiology',
    respiratory: high ? 'icu' : 'wardA', neuro: high ? 'icu' : 'wardB', general: priority === 'medium' ? 'wardA' : 'opd',
  };
  return map[patient.condition];
}

export const DEFAULT_RESOURCES = {
  beds: [
    { id: 'icu_1', type: 'icu', free: true }, { id: 'icu_2', type: 'icu', free: false },
    { id: 'hdu_1', type: 'hdu', free: true },
    { id: 'ward_1', type: 'ward', free: true }, { id: 'ward_2', type: 'ward', free: true }, { id: 'ward_3', type: 'ward', free: false },
    { id: 'day_1', type: 'day_care', free: true }, { id: 'day_2', type: 'day_care', free: true },
  ],
  doctors: [
    { id: 'dr_rao', specialty: 'cardiology', free: true }, { id: 'dr_shah', specialty: 'paediatrics', free: true },
    { id: 'dr_khan', specialty: 'orthopaedics', free: true }, { id: 'dr_nair', specialty: 'neurology', free: false },
    { id: 'dr_das', specialty: 'pulmonology', free: true }, { id: 'dr_pillai', specialty: 'general_medicine', free: true },
  ],
  diags: [
    { id: 'xray_1', type: 'xray', free: true }, { id: 'ct_1', type: 'ct', free: true },
    { id: 'mri_1', type: 'mri', free: false }, { id: 'lab_1', type: 'lab', free: true },
  ],
};

// Runs the complete patient journey through every technique that applies to one patient.
export async function runJourney(patient) {
  const triage = await classifyPatient(patient);
  const vitals = infer(VITALS_SYSTEM, { heartRate: patient.heartRate, temp: patient.temp });
  const { model } = getTrainedModel();
  const riskScore = scoreRisk(model, patient);
  const risk = { score: riskScore, category: riskCategory(riskScore) };
  const alloc = (await allocateAll(DEFAULT_RESOURCES, [{ id: 'p', priority: triage.priority, condition: patient.condition, diag: patient.diag }]))[0];
  const dest = destinationFor(patient, triage.priority);
  const adj = buildAdjacency();
  const route = triage.priority === 'high' ? astar(adj, 'ambulance', dest) : bfs(adj, 'entrance', dest);
  return { triage, vitals, risk, alloc, dest, route };
}

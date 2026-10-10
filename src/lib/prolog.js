import './tauShim.js';
import pl from 'tau-prolog';
import loadLists from 'tau-prolog/modules/lists.js';

loadLists(pl);

// Run a goal against a Prolog program (real Prolog via Tau Prolog) and collect all answers.
export function solveAll(program, goal, max = 100) {
  return new Promise((resolve, reject) => {
    const session = pl.create(200000);
    const fail = (e) => reject(new Error(String(e)));
    session.consult(program, {
      success() {
        session.query(goal, {
          success() {
            const out = [];
            const next = () => {
              if (out.length >= max) return resolve(out);
              session.answer({
                success(a) {
                  const b = {};
                  for (const k of Object.keys(a.links || {})) if (!k.startsWith('_')) b[k] = a.links[k].toString();
                  out.push(b);
                  next();
                },
                fail: () => resolve(out),
                error: fail,
                limit: () => resolve(out),
              });
            };
            next();
          },
          error: fail,
        });
      },
      error: fail,
    });
  });
}

// ------------------------------------------------------------------
// triage knowledge base (rules). Patient facts are appended.
// ------------------------------------------------------------------
export const SYMPTOMS = {
  severe: ['chest_pain', 'breathing_difficulty', 'unconscious', 'severe_bleeding', 'seizure', 'stroke_signs'],
  moderate: ['high_fever', 'persistent_vomiting', 'suspected_fracture', 'abdominal_pain', 'dizziness', 'dehydration'],
  mild: ['cough', 'sore_throat', 'headache', 'rash', 'runny_nose', 'fatigue'],
};
export const label = (s) => s.replace(/_/g, ' ');

export const TRIAGE_RULES = `:- use_module(library(lists)).
% ---- symptom knowledge base ----
${Object.entries(SYMPTOMS).map(([cls, list]) => list.map((s) => `${cls}(${s}).`).join(' ')).join('\n')}

% ---- patient categories ----
vulnerable(P) :- age(P, A), A < 5.
vulnerable(P) :- age(P, A), A > 65.

% ---- why a priority applies: priority_reason(Patient, Level, Reason) ----
priority_reason(P, high, severe_symptom(S))        :- has(P, S), severe(S).
priority_reason(P, high, extreme_pain(L))          :- pain(P, L), L >= 9.
priority_reason(P, high, vulnerable_and_moderate(S)) :- vulnerable(P), has(P, S), moderate(S).
priority_reason(P, high, dangerous_temperature(T)) :- temp(P, T), T >= 40.
priority_reason(P, medium, moderate_symptom(S))    :- has(P, S), moderate(S).
priority_reason(P, medium, notable_pain(L))        :- pain(P, L), L >= 6, L < 9.
priority_reason(P, medium, vulnerable_patient)     :- vulnerable(P), has(P, _).
priority_reason(P, medium, fever(T))               :- temp(P, T), T >= 38.5, T < 40.
priority_reason(P, medium, several_mild_symptoms(N)) :-
    findall(S, (has(P, S), mild(S)), L), length(L, N), N >= 3.
priority_reason(P, low, mild_symptom(S))           :- has(P, S), mild(S).

% ---- final decision: highest matching level wins ----
priority(P, high)   :- priority_reason(P, high, _), !.
priority(P, medium) :- priority_reason(P, medium, _), !.
priority(_, low).

% ---- recommended assessment priority ----
recommend(high,   'Immediate assessment - target under 10 minutes, route to Emergency Room').
recommend(medium, 'Prompt assessment - target within 60 minutes, monitor vitals every 30 min').
recommend(low,    'Routine assessment - OPD queue, target within 2-4 hours').
`;

export const patientFacts = (p) => [
  `age(p1, ${p.age}).`,
  `pain(p1, ${p.pain}).`,
  `temp(p1, ${p.temp}).`,
  ...p.symptoms.map((s) => `has(p1, ${s}).`),
].join('\n');

export async function classifyPatient(patient) {
  const program = `${TRIAGE_RULES}\n% ---- patient facts ----\n${patientFacts(patient)}\n`;
  const [prio] = await solveAll(program, 'priority(p1, X).', 1);
  const priority = prio.X;
  const reasons = (await solveAll(program, `priority_reason(p1, ${priority}, R).`)).map((r) => r.R);
  const [rec] = await solveAll(program, `recommend(${priority}, T).`, 1);
  return { priority, reasons, recommendation: rec.T.replace(/^'|'$/g, ''), program };
}

// ------------------------------------------------------------------
// resource allocation knowledge base.
// ------------------------------------------------------------------
export const RESOURCE_RULES = `% ---- allocation rules ----
% bed type needed by priority
bed_needed(high, icu).    bed_needed(medium, ward).   bed_needed(low, day_care).
% if the preferred bed type is full, try a step-up type
fallback_bed(icu, hdu).   fallback_bed(hdu, ward).    fallback_bed(ward, day_care).

% specialist needed by condition
specialty(cardiac, cardiology).     specialty(respiratory, pulmonology).
specialty(trauma, orthopaedics).    specialty(neuro, neurology).
specialty(paediatric, paediatrics). specialty(general, general_medicine).

alloc_bed(P, B)  :- needs(P, Prio, _, _), bed_needed(Prio, T), bed(B, T, free), !.
alloc_bed(P, B)  :- needs(P, Prio, _, _), bed_needed(Prio, T), fallback_bed(T, T2), bed(B, T2, free), !.
alloc_bed(_, none).

alloc_doctor(P, D) :- needs(P, _, C, _), specialty(C, S), doctor(D, S, free), !.
alloc_doctor(_, D) :- doctor(D, general_medicine, free), !.
alloc_doctor(_, none).

alloc_diag(P, X) :- needs(P, _, _, T), T \\== none, diag(X, T, free), !.
alloc_diag(P, none) :- needs(P, _, _, none), !.
alloc_diag(_, queued).

allocation(P, B, D, X) :- alloc_bed(P, B), alloc_doctor(P, D), alloc_diag(P, X).
`;

export async function allocateOne(resources, patient) {
  const facts = [
    ...resources.beds.map((b) => `bed(${b.id}, ${b.type}, ${b.free ? 'free' : 'occupied'}).`),
    ...resources.doctors.map((d) => `doctor(${d.id}, ${d.specialty}, ${d.free ? 'free' : 'busy'}).`),
    ...resources.diags.map((d) => `diag(${d.id}, ${d.type}, ${d.free ? 'free' : 'busy'}).`),
    `needs(p, ${patient.priority}, ${patient.condition}, ${patient.diag}).`,
  ].join('\n');
  const [r] = await solveAll(`${RESOURCE_RULES}\n${facts}\n`, 'allocation(p, B, D, X).', 1);
  return { bed: r.B, doctor: r.D, diag: r.X };
}

export async function allocateAll(resources, patients) {
  const rank = { high: 0, medium: 1, low: 2 };
  const order = [...patients].sort((a, b) => rank[a.priority] - rank[b.priority]);
  const state = {
    beds: resources.beds.map((b) => ({ ...b })),
    doctors: resources.doctors.map((d) => ({ ...d })),
    diags: resources.diags.map((d) => ({ ...d })),
  };
  const results = [];
  for (const p of order) {
    const a = await allocateOne(state, p);
    const bed = state.beds.find((b) => b.id === a.bed); if (bed) bed.free = false;
    const doc = state.doctors.find((d) => d.id === a.doctor); if (doc) doc.free = false;
    const dg = state.diags.find((d) => d.id === a.diag); if (dg) dg.free = false;
    results.push({ patient: p, ...a });
  }
  return results;
}

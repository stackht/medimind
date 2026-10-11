# MediMind: Smart Hospital Assistant

An educational, frontend-only hospital operations dashboard. One shared, seeded simulation of synthetic patients
drives every page, and each decision is made by an algorithm implemented in this project.

**Problem statement.** Hospitals must coordinate many decisions at once: who is seen first, how patients are
monitored and risk-scored, which beds, doctors and scanners they get, how emergency transfers move through the
building, how rooms are controlled, how digital systems are defended, what the records reveal, and how patients are
kept informed. MediMind is one integrated assistant for all of this. The ten AI techniques are its features and are
also available as stand-alone experiments.

## Dashboard (live simulation)

| Page | What it does | Algorithm |
|------|--------------|-----------|
| Overview | KPIs, queue, workload, bed occupancy, AI decision summary, alerts | all of the below |
| Patient Management | Searchable, sortable, filterable patient table with detail drawer | Prolog triage results |
| Patient Triage | Suggested priority, factors, Prolog console, walk-in triage form | Prolog rules |
| Hospital Resources | Beds, doctors, diagnostics; adjust capacity; allocation log | Prolog allocation rules |
| Emergency Routing | Route map, closable corridors, cost and nodes expanded | A* search |
| Patient Monitoring | Live vitals per patient, department room lighting | Fuzzy inference, fuzzy control, neuro-fuzzy risk |
| Traffic & Queue Analytics | Department, priority, waiting-time and utilization charts | simulation state |
| Reports & Settings | CSV/JSON export, arrival rate, seed, reduce motion | n/a |

Simulation controls: start, pause, reset, speed (1x to 8x), add patient, trigger emergency, adjust resources.

## AI Experiments

The ten problem statements, each a self-contained experiment that can load a patient from the live simulation:

| # | Experiment | Technique |
|---|------------|-----------|
| 1 | AI-Based Patient Triage and Monitoring System | Problem formulation and the PEAS model |
| 2 | Patient Priority Classification | Prolog facts and rules |
| 3 | Patient Navigation | BFS, DFS, state-space search |
| 4 | Emergency Patient Route Optimization | A* search |
| 5 | Healthcare Resource Security | Minimax with alpha-beta pruning |
| 6 | Intelligent Patient Monitoring | Fuzzy logic controller |
| 7 | Smart Hospital Room Environment Control | Mamdani and Sugeno FIS, compared |
| 8 | Hybrid Neuro-Fuzzy Risk Estimation | ANFIS (neural learning and fuzzy inference) |
| 9 | Patient Classification and Pattern Discovery | Perceptron and competitive learning |
| 10 | Healthcare Text Prediction and Generation | Bigram micro LM and trigram SLM |

The live dashboard additionally allocates beds, doctors and diagnostics with a Prolog knowledge base (a supporting rule base, not one of the ten experiments).

## Run

```bash
npm install
npm run dev      # development
npm run build    # production build in dist/
npm run preview  # serve the build
```

## Layout

- `src/lib/` – all algorithms, written from scratch (`graph`, `search`, `prolog`, `fuzzy`, `anfis`, `learn`, `minimax`, `ngram`)
- `src/lib/sim.js` – the shared simulation engine; `src/lib/simData.js` – synthetic patient generator
- `src/pages/` – dashboard pages; `src/modules/` – the ten experiments (and the end-to-end journey)
- `src/components/` – shared UI, SVG hospital map and charts
- `src/lib/tauShim.js` – lets tau-prolog load under ES-module strict mode

Not medical advice. Illustrative and educational only.

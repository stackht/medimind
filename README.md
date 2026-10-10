# MediMind – AI-Powered Smart Hospital Assistant

A frontend-only React demo that follows one simulated patient through a hospital and solves each
stage with a different classical AI technique. All data is synthetic; there is no backend.

| PS | Module | Technique |
|----|--------|-----------|
| 1  | Patient Navigation  | BFS, DFS, state-space search |
| 2  | Priority Triage     | Prolog facts + rules (Tau Prolog) |
| 3  | Resource Manager    | Prolog knowledge base + allocation rules |
| 4  | Emergency Router    | A* with admissible heuristic, blocked corridors |
| 5  | Security Ops        | Minimax game tree with alpha-beta pruning |
| 6  | Vitals Monitor      | Mamdani fuzzy inference |
| 7  | Smart Room          | Fuzzy control (27 rules) |
| 8  | Risk Estimator      | Neuro-fuzzy (ANFIS, back-propagation) |
| 9  | Patient Insights    | Perceptron + competitive learning |
| 10 | Health Messages     | Bigram µLM and trigram SLM |

## Run

```bash
npm install
npm run dev      # development
npm run build    # production build in dist/
npm run preview  # serve the build
```

## Layout

- `src/lib/` – all algorithms, written from scratch (`graph`, `search`, `prolog`, `fuzzy`, `anfis`, `learn`, `minimax`, `ngram`)
- `src/modules/` – one page per problem statement, plus the journey dashboard
- `src/components/` – shared UI, SVG hospital map and charts
- `src/lib/tauShim.js` – lets tau-prolog load under ES-module strict mode

Not medical advice. Illustrative and educational only.

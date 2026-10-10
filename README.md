# MediMind – AI-Powered Smart Hospital Assistant

**Problem statement.** Hospitals must coordinate many decisions at once: who is seen first, how patients are
monitored and risk-scored, which beds, doctors and scanners they get, how they and emergency transfers move
through the building, how rooms are controlled, how digital systems are defended, what the records reveal, and
how patients are kept informed. MediMind is one integrated AI assistant that handles all of this for a simulated
patient, with every capability backed by a different classical AI technique.

A frontend-only React demo. All data is synthetic; there is no backend.

| Feature | Technique |
|---------|-----------|
| Patient navigation | BFS, DFS, state-space search |
| Priority triage | Prolog facts and rules (Tau Prolog) |
| Resource allocation | Prolog knowledge base and allocation rules |
| Emergency routing | A* with an admissible heuristic, blocked corridors |
| Security operations | Minimax game tree with alpha-beta pruning |
| Vitals monitoring | Mamdani fuzzy inference |
| Room environment | Fuzzy control (27 rules) |
| Risk estimation | Neuro-fuzzy network (ANFIS, back-propagation) |
| Patient insights | Perceptron and competitive learning |
| Health messaging | Bigram and trigram language models |

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

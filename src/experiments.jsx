import Navigation from './modules/Navigation.jsx';
import TriageLab from './modules/Triage.jsx';
import Peas from './modules/Peas.jsx';
import EmergencyLab from './modules/Emergency.jsx';
import Security from './modules/Security.jsx';
import Vitals from './modules/Vitals.jsx';
import Room from './modules/Room.jsx';
import Risk from './modules/Risk.jsx';
import Insights from './modules/Insights.jsx';
import Messages from './modules/Messages.jsx';
import Journey from './modules/Journey.jsx';

// The ten problem statements, shown as experiments of one integrated system.
// `patient: true` means the experiment reads the shared "selected patient" (loadable from the live simulation).
export const EXPERIMENTS = [
  { slug: 'peas', n: 1, title: 'AI-Based Patient Triage and Monitoring System (Problem Formulation and PEAS)', short: 'Problem formulation and PEAS', technique: 'Problem formulation, PEAS model', patient: true,
    objective: 'Identify an AI problem, describe it with the PEAS model (Performance measure, Environment, Actuators, Sensors) and formulate it for an intelligent patient triage and monitoring agent.',
    link: 'The performance measures are computed live from the shared simulation, and the agent can act on any simulated patient.', el: <Peas /> },
  { slug: 'priority-triage', n: 2, title: 'Patient Priority Classification using PROLOG', short: 'Priority classification', technique: 'Prolog facts and rules', patient: true,
    objective: 'Turn reported symptoms into Prolog facts and let a rule base classify the case as low, medium or high priority with a recommended assessment priority.',
    link: 'The live triage in the dashboard runs these same rules for every arriving patient.', el: <TriageLab /> },
  { slug: 'navigation', n: 3, title: 'Patient Navigation using AI Search Algorithms', short: 'Patient navigation', technique: 'BFS, DFS, state-space search', patient: true,
    objective: 'Represent hospital locations as states and use uninformed search (BFS and DFS) to find a suitable path from the current location to the required department, comparing hops and walking cost.',
    link: 'The suggested destination follows the selected patient’s condition.', el: <Navigation /> },
  { slug: 'emergency-routing', n: 4, title: 'Emergency Patient Route Optimization using A*', short: 'A* routing', technique: 'A* search, heuristic functions', patient: true,
    objective: 'Find a low-cost route for an emergency patient while avoiding blocked corridors, unavailable paths and transport restrictions.',
    link: 'The Emergency Routing page runs this algorithm on live simulated emergencies.', el: <EmergencyLab /> },
  { slug: 'security', n: 5, title: 'Healthcare Resource Security using Minimax', short: 'Resource security', technique: 'Minimax, game trees, alpha-beta pruning',
    objective: 'A defender with limited hardening resources protects hospital servers and patient-record services from a hypothetical attacker. Minimax evaluates predefined utilities to choose a defensive strategy.',
    link: 'Self-contained game simulation using predefined utility values.', el: <Security /> },
  { slug: 'vitals', n: 6, title: 'Intelligent Patient Monitoring using Fuzzy Logic', short: 'Patient monitoring', technique: 'Fuzzy logic controller, membership functions', patient: true,
    objective: 'Implement a simple fuzzy logic controller that interprets heart rate and body temperature falling between categories and produces an illustrative monitoring priority.',
    link: 'The Patient Monitoring page scores every active patient with this fuzzy system.', el: <Vitals /> },
  { slug: 'room', n: 7, title: 'Smart Hospital Room Environment Control using Mamdani/Sugeno FIS', short: 'Mamdani and Sugeno FIS', technique: 'Mamdani FIS, Sugeno FIS, rule-based control',
    objective: 'Develop a fuzzy inference system with both the Mamdani and Sugeno approaches that determines simulated room-lighting intensity from ambient light, room occupancy and activity level, and compare their outputs.',
    link: 'Patient Monitoring shows the Mamdani controller for each department room.', el: <Room /> },
  { slug: 'risk', n: 8, title: 'Hybrid Neuro-Fuzzy Patient Risk Estimation', short: 'Risk estimation', technique: 'Neural network + fuzzy inference (ANFIS)', patient: true,
    objective: 'Combine neural-network learning with fuzzy reasoning to estimate an illustrative risk score from a synthetic, de-identified dataset.',
    link: 'Each simulated patient receives a risk score from this trained model.', el: <Risk /> },
  { slug: 'insights', n: 9, title: 'Patient Category Classification and Healthcare Pattern Discovery', short: 'Pattern discovery', technique: 'Perceptron, competitive learning',
    objective: 'Classify labelled synthetic patient records with the Perceptron learning rule, and discover groups of similar records without labels using competitive learning.',
    link: 'Runs on a synthetic dataset generated for the experiment.', el: <Insights /> },
  { slug: 'messages', n: 10, title: 'Healthcare Text Prediction and Generation using µLM / SLM', short: 'Text generation', technique: 'Bigram and trigram language models',
    objective: 'Predict the next word and generate short healthcare information messages from a predefined corpus using a bigram µLM (one previous word) and a trigram SLM (two previous words).',
    link: 'Trained on an editable healthcare corpus.', el: <Messages /> },
  { slug: 'journey', n: 0, title: 'End-to-end patient journey', short: 'Patient journey', technique: 'All techniques chained', patient: true, extra: true,
    objective: 'Run one patient through triage, monitoring, risk, allocation, routing, room control and messaging in sequence.',
    link: 'Chains the individual experiments for the selected patient.', el: <Journey /> },
];

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';

import App from './App.jsx';
import { FeedbackProvider } from './components/feedback.jsx';
import { getReduceMotion, setReduceMotion } from './lib/prefs.js';
import { PatientProvider } from './context/PatientContext.jsx';

setReduceMotion(getReduceMotion());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <PatientProvider>
        <FeedbackProvider>
          <App />
        </FeedbackProvider>
      </PatientProvider>
    </HashRouter>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import './visual.css';
import App from './App.jsx';
import { PatientProvider } from './context/PatientContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <PatientProvider>
        <App />
      </PatientProvider>
    </HashRouter>
  </StrictMode>,
);

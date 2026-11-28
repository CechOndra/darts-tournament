import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';
import './powercards/power-card.css';
import './powercards/looks.css';
import { attachTilt } from './powercards/power-card.js';

attachTilt(); // holo tilt on hover / drag for every .pc-card

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

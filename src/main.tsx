import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './App';
import { applyTheme, currentTheme } from './ui/theme';
import { claimGuestFromLocation } from './ui/guest';

claimGuestFromLocation();
applyTheme(currentTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

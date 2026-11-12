import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './refino.css';
import App from './App';
import { applySavedTheme } from './components/ui';

applySavedTheme();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

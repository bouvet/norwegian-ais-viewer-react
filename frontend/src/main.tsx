import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// StrictMode intentionally omitted: react-leaflet v5 + React 19 StrictMode
// causes a "Map container is already initialized" error in development.
createRoot(document.getElementById('root')!).render(<App />);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './app/App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('RoomFit could not find the root element.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

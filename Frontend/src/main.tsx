import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { API_BASE } from './api/client';

async function start() {
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    const { installDemoServer } = await import('./demo/demoServer');
    installDemoServer(API_BASE);
  }
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

start();

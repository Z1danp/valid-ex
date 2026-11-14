import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@glideapps/glide-data-grid/dist/index.css';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Gagal menemukan root element di index.html');
}

// Ensure Glide Data Grid overlay editor portal is always present in DOM
if (!document.getElementById('portal')) {
  const portalDiv = document.createElement('div');
  portalDiv.id = 'portal';
  portalDiv.style.position = 'fixed';
  portalDiv.style.left = '0';
  portalDiv.style.top = '0';
  portalDiv.style.zIndex = '9999';
  document.body.appendChild(portalDiv);
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

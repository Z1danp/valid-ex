import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mengambil elemen div ber-id 'root' dari index.html
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Gagal menemukan root element di index.html');
}

// Inisialisasi React 18 Concurrent Root
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
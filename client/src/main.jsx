// Titik masuk antarmuka SIAPKas.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth.jsx';
import { KonfirmasiProvider, ToastProvider } from './components/ui.jsx';
import { App } from './App.jsx';
import './styles/app.css';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // Galat 4xx (misalnya tidak berwenang) tidak diulang; galat jaringan atau server diulang sekali.
      retry: (jumlah, galat) => (galat?.status === 0 || galat?.status >= 500) && jumlah < 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <KonfirmasiProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </KonfirmasiProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);

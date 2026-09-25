import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Saat pengembangan, permintaan /api diteruskan ke server Express lokal.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.SIAPKAS_API || 'http://localhost:3000' },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1500 },
});

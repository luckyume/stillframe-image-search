import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/query': 'http://localhost:3001',
      '/recent': 'http://localhost:3001',
      '/api': 'http://localhost:3001',
    },
  },
});

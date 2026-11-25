import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendProxy = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true
  },
  '/health': {
    target: 'http://localhost:8000',
    changeOrigin: true
  },
  '/ws': {
    target: 'ws://localhost:8000',
    ws: true
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: backendProxy
  },
  preview: {
    proxy: backendProxy
  }
});

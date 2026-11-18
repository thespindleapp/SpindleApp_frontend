import http from 'node:http';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiAgent = new http.Agent({ keepAlive: false });

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true, agent: apiAgent },
      '/health': { target: 'http://127.0.0.1:4000', changeOrigin: true, agent: apiAgent },
    },
  },
});

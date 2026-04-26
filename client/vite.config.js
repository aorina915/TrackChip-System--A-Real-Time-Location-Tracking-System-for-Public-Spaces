import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176
  },
  define: {
    'process.env.VITE_SERVER_URL': JSON.stringify(process.env.VITE_SERVER_URL || 'http://localhost:4000')
  }
});

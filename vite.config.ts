import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_VERCEL_TARGET_ENV': JSON.stringify(
      process.env.VERCEL_TARGET_ENV ?? '',
    ),
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        // Keep Host: localhost:5173 so OAuth redirect_uri matches Google Console
        changeOrigin: false,
      },
    },
  },
});

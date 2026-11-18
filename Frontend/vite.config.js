import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      // Same-origin in dev so the httpOnly refresh cookie works (prod: Nginx does the same)
      proxy: {
        '/api': { target: env.VITE_API_PROXY || 'http://localhost:5000', changeOrigin: true },
        '/uploads': { target: env.VITE_API_PROXY || 'http://localhost:5000', changeOrigin: true },
        '/Api': { target: env.VITE_API_PROXY || 'http://localhost:5000', changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Long-cached vendor chunks (change rarely, app code changes often)
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/[\\/](@reduxjs|react-redux|redux|immer|reselect|axios)[\\/]/.test(id)) return 'state';
            if (/[\\/](react-hook-form|zod|@hookform)[\\/]/.test(id)) return 'forms';
            return 'vendor';
          },
        },
      },
    },
  };
});

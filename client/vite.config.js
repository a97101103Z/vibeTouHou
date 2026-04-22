import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // During `npm run dev`, forward all /api calls to the FastAPI server
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        credentials: true,
      },
    },
  },
  build: {
    outDir: '../server/static',
    emptyOutDir: true,
    sourcemap: false,  // Do not expose source maps to clients
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false },
      mangle: true,
    },
  },
});

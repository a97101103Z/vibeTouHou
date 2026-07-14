import { defineConfig } from "vite";
import { resolve } from "path";

const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // During `npm run dev`, forward all /api calls to the FastAPI server
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    outDir: "../server/static",
    emptyOutDir: true,
    sourcemap: false, // Do not expose source maps to clients
    minify: "terser",
    terserOptions: {
      compress: { drop_console: false },
      mangle: true,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
        leaderboard: resolve(__dirname, "leaderboard.html"),
        showcase: resolve(__dirname, "showcase.html"),
      },
    },
  },
});

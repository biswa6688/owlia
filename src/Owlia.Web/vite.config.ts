import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Backend dev port — must match Owlia.Host's "Owlia:Port" (appsettings.json,
// default 5174). Override both sides together via OWLIA_BACKEND_PORT.
const BACKEND_PORT = process.env.OWLIA_BACKEND_PORT ?? '5174'
const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    outDir: '../Owlia.Host/wwwroot',
    emptyOutDir: true,
  },

  // ── Dev server proxy ──────────────────────────────────────────────────────
  // Forwards /api/* and /hub/* from the Vite dev server (localhost:5173)
  // to the running .NET Kestrel backend (127.0.0.1:5174).
  // This means 'npm run dev' works without CORS issues and SignalR connects.
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/hub': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: true,          // proxy WebSocket connections (SignalR transport)
      },
    },
  },

  // Expose backend URL to the app so signalr.ts can build the absolute URL
  // when running in dev mode. In production (built into wwwroot) this is empty
  // because the frontend is served from the same origin as the backend.
  define: {
    __DEV_BACKEND__: JSON.stringify(BACKEND),
  },
})

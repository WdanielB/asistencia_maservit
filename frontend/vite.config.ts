import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El frontend usa rutas relativas (/api, /uploads). En desarrollo, Vite las
// redirige al backend local; en producción lo hace nginx (ver frontend/nginx.conf).
const BACKEND = process.env.VITE_BACKEND ?? 'http://localhost:5000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/uploads': { target: BACKEND, changeOrigin: true },
      '/health': { target: BACKEND, changeOrigin: true },
    },
  },
})

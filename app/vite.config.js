import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API_PROXY_TARGET lets a host-side dev server (outside compose) reach the
// api container via its published port instead of the compose DNS name.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.UI_PORT) || 3000,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://api:3003',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'build'
  }
})

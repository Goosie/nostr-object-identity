import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 12000,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    headers: {
      'X-Frame-Options': 'ALLOWALL'
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 12000,
    allowedHosts: true
  }
})
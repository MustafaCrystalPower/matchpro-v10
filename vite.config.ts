import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/proxy/api': {
        target: 'http://20.69.29.54:3070',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/api/, '/api'),
        timeout: 8000
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react')) return 'react-vendor'
          if (id.includes('recharts')) return 'recharts'
          if (id.includes('framer-motion')) return 'framer-motion'
        }
      }
    }
  }
})

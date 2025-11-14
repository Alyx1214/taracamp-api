import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://taracamp-api.onrender.com',
        //target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      '/ws': {
        target: 'wss://taracamp-api.onrender.com',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.docx'],
  server: {
    proxy: {
      '/api': {
        target: 'https://taracamp-api.azurewebsites.net',
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

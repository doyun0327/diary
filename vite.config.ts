import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Spring Boot 백엔드 (AI 포함 모든 /api)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 300_000,
        proxyTimeout: 300_000,
        // Android WebView가 http://10.x.x.x:5173 으로 오면 Origin이 CORS에 걸려 403
        // → Spring에는 localhost Origin으로 전달
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'http://localhost:5173')
            proxyReq.setHeader('Referer', 'http://localhost:5173/')
          })
        },
      },
    },
  },
})

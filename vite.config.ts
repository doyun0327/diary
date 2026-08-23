import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // full lottie.js 는 AE expression용 eval 포함 → 빌드 [EVAL] 경고
    // 로딩 애니메이션은 light 빌드로 충분
    alias: {
      'lottie-web': path.resolve(
        rootDir,
        'node_modules/lottie-web/build/player/lottie_light.js',
      ),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
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

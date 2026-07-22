import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { testBackendConnection } from './api/testApi'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  testBackendConnection()
    .then(({ message }) => console.info(`[API] ${message}`))
    .catch((error: unknown) => console.error('[API] 연결 테스트 실패', error))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

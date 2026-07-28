import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { testBackendConnection } from './api/testApi'
import './i18n'
import { applyStoredTheme } from './utils/theme'
import './index.css'
import App from './App.tsx'

applyStoredTheme()

if (import.meta.env.DEV) {
  testBackendConnection()
    .then(({ message }) => console.info(`[API] ${message}`))
    .catch((error: unknown) => console.error('[API] connection test failed', error))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

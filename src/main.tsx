import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { testBackendConnection } from './api/testApi'
import './i18n'
import { applyLanguageFonts } from './utils/fonts'
import { applyStoredTheme } from './utils/theme'
import { isFlutterApp } from './utils/nativeShare'
import {
  isValidInviteCode,
  normalizeInviteCode,
  takePendingRoomInvite,
  tryOpenAppOrStore,
} from './utils/roomInvite'
import './index.css'
import App from './App.tsx'

/** 브라우저에서 /join 초대 URL로 SPA가 뜨면 앱·스토어로만 보내고 렌더 중단 */
function shouldBlockWebInviteEntry(): boolean {
  if (typeof window === 'undefined' || isFlutterApp()) return false
  try {
    const url = new URL(window.location.href)
    const isJoin =
      url.pathname === '/join' || url.pathname.startsWith('/join/')
    if (!isJoin) return false
    let code = normalizeInviteCode(url.searchParams.get('code'))
    if (!isValidInviteCode(code)) {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) code = normalizeInviteCode(parts[1])
    }
    if (isValidInviteCode(code)) {
      takePendingRoomInvite()
      tryOpenAppOrStore(code)
    }
    return true
  } catch {
    return false
  }
}

applyStoredTheme()
applyLanguageFonts()

if (import.meta.env.DEV) {
  testBackendConnection()
    .then(({ message }) => console.info(`[API] ${message}`))
    .catch((error: unknown) => console.error('[API] connection test failed', error))
}

if (!shouldBlockWebInviteEntry()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'picture-diary-screen-lock';

export interface ScreenLockConfig {
  enabled: boolean;
  /** hex SHA-256 of salt:password */
  passwordHash: string;
  salt: string;
}

function loadConfig(): ScreenLockConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScreenLockConfig;
    if (!parsed?.passwordHash || !parsed?.salt) return null;
    return {
      enabled: Boolean(parsed.enabled),
      passwordHash: parsed.passwordHash,
      salt: parsed.salt,
    };
  } catch {
    return null;
  }
}

function saveConfig(config: ScreenLockConfig | null) {
  try {
    if (config) localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function useScreenLock() {
  const [config, setConfig] = useState<ScreenLockConfig | null>(loadConfig);
  /** false면 잠금 화면. 앱 시작·백그라운드 복귀 시 다시 잠김 */
  const [unlocked, setUnlocked] = useState(false);

  const hasPin = Boolean(config?.passwordHash && config.salt);
  const enabled = Boolean(config?.enabled && hasPin);
  const locked = enabled && !unlocked;

  useEffect(() => {
    if (!enabled) return;

    const relock = () => setUnlocked(false);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') relock();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', relock);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', relock);
    };
  }, [enabled]);

  const verifyPassword = useCallback(
    async (password: string) => {
      if (!config?.passwordHash || !config.salt) return false;
      const hash = await hashPassword(password, config.salt);
      return hash === config.passwordHash;
    },
    [config],
  );

  const unlock = useCallback(
    async (password: string) => {
      const ok = await verifyPassword(password);
      if (ok) setUnlocked(true);
      return ok;
    },
    [verifyPassword],
  );

  /** 첫 설정: PIN 저장 후 잠금 ON */
  const enableLock = useCallback(async (password: string) => {
    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    const next: ScreenLockConfig = { enabled: true, passwordHash, salt };
    saveConfig(next);
    setConfig(next);
    setUnlocked(true);
  }, []);

  /** 이미 PIN이 있을 때 다시 ON (설정 화면 없음) */
  const turnOn = useCallback(() => {
    if (!config?.passwordHash || !config.salt) return false;
    const next: ScreenLockConfig = { ...config, enabled: true };
    saveConfig(next);
    setConfig(next);
    setUnlocked(true);
    return true;
  }, [config]);

  /** PIN 확인 후 잠금 OFF (PIN은 유지 → 다음에 바로 켤 수 있음) */
  const disableLock = useCallback(
    async (password: string) => {
      if (!config?.passwordHash || !config.salt) return false;
      const ok = await verifyPassword(password);
      if (!ok) return false;
      const next: ScreenLockConfig = { ...config, enabled: false };
      saveConfig(next);
      setConfig(next);
      setUnlocked(true);
      return true;
    },
    [config, verifyPassword],
  );

  return {
    enabled,
    hasPin,
    locked,
    unlock,
    enableLock,
    turnOn,
    disableLock,
  };
}

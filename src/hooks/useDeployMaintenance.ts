import { useEffect, useRef, useState } from 'react';
import { fetchDeployStatus } from '../utils/deployStatus';
import { hasAiPickPending } from '../utils/aiPickPending';

const POLL_MS = 2500;

/**
 * 배포(MAINTENANCE) 중이면 true.
 * 이미 열린 WebView/탭도 폴링으로 감지한다.
 * 로컬 dev에는 deploy-status.json 이 없어 폴링하지 않음.
 * AI 그림 선택 대기 중이면 새로고침을 미뤄 선택지가 사라지지 않게 한다.
 */
export function useDeployMaintenance(): boolean {
  const [maintenance, setMaintenance] = useState(false);
  const wasOnRef = useRef(false);
  const reloadTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Vite 개발 서버 — 배포 상태 엔드포인트 없음 → 404 스팸 방지
    if (import.meta.env.DEV) return;

    let cancelled = false;
    let timer: number | undefined;

    const scheduleReload = () => {
      if (reloadTimerRef.current != null) {
        window.clearTimeout(reloadTimerRef.current);
      }
      const tryReload = () => {
        if (cancelled) return;
        if (hasAiPickPending()) {
          reloadTimerRef.current = window.setTimeout(tryReload, 1000);
          return;
        }
        window.location.reload();
      };
      reloadTimerRef.current = window.setTimeout(tryReload, 200);
    };

    const tick = async () => {
      try {
        const { maintenance: on } = await fetchDeployStatus();
        if (cancelled) return;
        if (on) {
          wasOnRef.current = true;
          setMaintenance(true);
          return;
        }
        if (wasOnRef.current) {
          // 배포 끝 → 작성 초안 flush 후 새 번들 (AI 선택 중이면 대기)
          wasOnRef.current = false;
          setMaintenance(false);
          window.dispatchEvent(new Event('diary-flush-draft'));
          scheduleReload();
          return;
        }
        setMaintenance(false);
      } catch {
        // 네트워크 잠깐 끊겨도 무시
      }
    };

    void tick();
    timer = window.setInterval(() => {
      void tick();
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      if (reloadTimerRef.current != null) {
        window.clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  return maintenance;
}

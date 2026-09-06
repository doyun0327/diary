import { useEffect, useRef, useState } from 'react';
import { fetchDeployStatus } from '../utils/deployStatus';

const POLL_MS = 2500;

/**
 * 배포(MAINTENANCE) 중이면 true.
 * 이미 열린 WebView/탭도 폴링으로 감지한다.
 */
export function useDeployMaintenance(): boolean {
  const [maintenance, setMaintenance] = useState(false);
  const wasOnRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

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
          // 배포 끝 → 작성 초안 flush 후 새 번들
          wasOnRef.current = false;
          setMaintenance(false);
          window.dispatchEvent(new Event('diary-flush-draft'));
          window.setTimeout(() => {
            window.location.reload();
          }, 200);
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
    };
  }, []);

  return maintenance;
}

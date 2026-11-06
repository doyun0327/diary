import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLottie } from 'lottie-react';
import './CloudSyncLoadingOverlay.css';

const LOTTIE_URL = '/lottie/ai-loading-cat.json';

function SyncLottie({ animationData }: { animationData: object }) {
  const { View } = useLottie({
    animationData,
    loop: true,
    autoplay: true,
  });
  return <div className="cloud-sync-loading__lottie">{View}</div>;
}

interface CloudSyncLoadingOverlayProps {
  message: string;
}

export default function CloudSyncLoadingOverlay({ message }: CloudSyncLoadingOverlayProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(LOTTIE_URL)
      .then((res) => res.json())
      .then((json: object) => {
        if (!cancelled) setAnimationData(json);
      })
      .catch(() => {
        // lottie 없어도 문구는 표시
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // #root 가 아니라 body 에 올려 React 트리/작업 화면이 덮어씌워지지 않게 함
  return createPortal(
    <div
      className="cloud-sync-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="cloud-sync-loading__panel">
        {animationData ? <SyncLottie animationData={animationData} /> : null}
        <p className="cloud-sync-loading__text">{message}</p>
      </div>
    </div>,
    document.body,
  );
}

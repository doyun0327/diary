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
    document.getElementById('root') ?? document.body,
  );
}

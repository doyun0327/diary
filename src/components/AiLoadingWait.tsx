import { useLottie } from 'lottie-react';
import './AiLoadingWait.css';

function AiLoadingLottie({ animationData }: { animationData: object }) {
  const { View } = useLottie({
    animationData,
    loop: true,
    autoplay: true,
  });
  return <div className="ai-loading-wait__lottie">{View}</div>;
}

interface AiLoadingWaitProps {
  animationData: object | null;
  lottieKey: number;
  statusText: string;
}

export default function AiLoadingWait({ animationData, lottieKey, statusText }: AiLoadingWaitProps) {
  return (
    <div className="ai-loading-wait" aria-busy="true" aria-label={statusText}>
      {animationData ? (
        <AiLoadingLottie key={lottieKey} animationData={animationData} />
      ) : null}
      <p className="ai-loading-wait__status">{statusText}</p>
    </div>
  );
}

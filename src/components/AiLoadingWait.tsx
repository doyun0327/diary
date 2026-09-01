import { Fragment } from 'react';
import { useLottie } from 'lottie-react';
import { useTranslation } from 'react-i18next';
import { AI_PROGRESS_STEPS, type AiProgress } from '../api/aiImage';
import './AiLoadingWait.css';

function AiLoadingLottie({ animationData }: { animationData: object }) {
  const { View } = useLottie({
    animationData,
    loop: true,
    autoplay: true,
  });
  return <div className="ai-loading-wait__lottie">{View}</div>;
}

const STEP_LABEL_KEYS: Record<AiProgress, string> = {
  waiting: 'write.ai.stepWaiting',
  drawing: 'write.ai.stepDrawing',
  finishing: 'write.ai.stepFinishing',
};

interface AiLoadingWaitProps {
  animationData: object | null;
  lottieKey: number;
  statusText: string;
  step: AiProgress;
}

export default function AiLoadingWait({ animationData, lottieKey, statusText, step }: AiLoadingWaitProps) {
  const { t } = useTranslation();
  const activeIndex = AI_PROGRESS_STEPS.indexOf(step);

  return (
    <div className="ai-loading-wait" role="status" aria-live="polite" aria-busy="true" aria-label={statusText}>
      <div className="ai-loading-wait__panel">
        {animationData ? (
          <AiLoadingLottie key={lottieKey} animationData={animationData} />
        ) : null}
        <p className="ai-loading-wait__text">{statusText}</p>
        <div className="ai-loading-wait__track" aria-hidden>
          {AI_PROGRESS_STEPS.map((id, index) => (
            <Fragment key={id}>
              <div
                className={`ai-loading-wait__step${index === activeIndex ? ' is-active' : ''}${index < activeIndex ? ' is-done' : ''}`}
              >
                <span className="ai-loading-wait__step-dot" />
                <span className="ai-loading-wait__step-label">{t(STEP_LABEL_KEYS[id])}</span>
              </div>
              {index < AI_PROGRESS_STEPS.length - 1 ? (
                <div
                  className={`ai-loading-wait__connector${index === activeIndex ? ' is-active' : ''}${index < activeIndex ? ' is-done' : ''}`}
                >
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

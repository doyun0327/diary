import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './CoachBubble.css';

type CoachArrow =
  | 'bottom'
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'top-center'
  | 'top-left'
  | 'top-right';

interface CoachBubbleProps {
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
  arrow?: CoachArrow;
  /** 닫기 버튼 숨김 (바깥 탭으로만 닫을 때) */
  hideDismiss?: boolean;
}

function MiniPaw({ x, y, rotate, opacity }: {
  x: number;
  y: number;
  rotate: number;
  opacity: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotate})`}
      opacity={opacity}
    >
      {/* 발가락 4개 + 발바닥 */}
      <ellipse cx="-4.2" cy="-3.6" rx="1.25" ry="1.55" />
      <ellipse cx="-1.4" cy="-5.2" rx="1.3" ry="1.65" />
      <ellipse cx="1.4" cy="-5.2" rx="1.3" ry="1.65" />
      <ellipse cx="4.2" cy="-3.6" rx="1.25" ry="1.55" />
      <ellipse cx="0" cy="0.4" rx="3.4" ry="2.9" />
    </g>
  );
}

/** 발자국 2개 · 발가락 각 4개 */
function PawTrailIcon() {
  return (
    <svg
      className="coach-bubble__paw-svg"
      viewBox="0 0 28 24"
      width="30"
      height="22"
      aria-hidden
    >
      <MiniPaw x={9} y={15} rotate={-18} opacity={0.55} />
      <MiniPaw x={19} y={10} rotate={16} opacity={1} />
    </svg>
  );
}

/** 온보딩용 고양이 말풍선 — 테마 색 + 발바닥 */
function CoachBubble({
  children,
  onDismiss,
  className = '',
  arrow = 'bottom',
  hideDismiss = false,
}: CoachBubbleProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`coach-bubble coach-bubble--arrow-${arrow}${className ? ` ${className}` : ''}`}
      role="status"
    >
      <span className="coach-bubble__paw" aria-hidden>
        <PawTrailIcon />
      </span>
      <div className="coach-bubble__body">{children}</div>
      {!hideDismiss && (
        <button
          type="button"
          className="coach-bubble__dismiss"
          aria-label={t('common.close')}
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default CoachBubble;

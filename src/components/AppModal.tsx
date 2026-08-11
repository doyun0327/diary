import type { ReactNode } from 'react';
import './AppModal.css';

type AppModalProps = {
  title: string;
  lead?: string;
  children?: ReactNode;
  /** 배경 클릭 / Escape 기본 */
  onDismiss?: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  ariaLabelledBy?: string;
};

/** 앱 공통 중앙 모달 (방 생성·공유 결과 등) */
export default function AppModal({
  title,
  lead,
  children,
  onDismiss,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  ariaLabelledBy = 'app-modal-title',
}: AppModalProps) {
  return (
    <div className="app-modal" role="dialog" aria-modal="true" aria-labelledby={ariaLabelledBy}>
      <button
        type="button"
        className="app-modal__backdrop"
        aria-label="close"
        onClick={onDismiss ?? onSecondary ?? onPrimary}
      />
      <div className="app-modal__panel">
        <h3 id={ariaLabelledBy}>{title}</h3>
        {lead ? <p className="app-modal__lead">{lead}</p> : null}
        {children}
        {(primaryLabel || secondaryLabel) && (
          <div className="app-modal__actions">
            {secondaryLabel ? (
              <button
                type="button"
                className="app-modal__btn"
                onClick={onSecondary ?? onDismiss}
              >
                {secondaryLabel}
              </button>
            ) : null}
            {primaryLabel ? (
              <button
                type="button"
                className="app-modal__btn app-modal__btn--primary"
                onClick={onPrimary ?? onDismiss}
              >
                {primaryLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

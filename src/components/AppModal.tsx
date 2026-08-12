import type { ReactNode } from 'react';
import CloseIcon from './CloseIcon';
import './AppModal.css';

type AppModalProps = {
  title: string;
  lead?: string;
  children?: ReactNode;
  /** 배경 클릭 / X 닫기 */
  onDismiss?: () => void;
  /** 우상단 X 버튼 표시 (onDismiss 있을 때 기본 true) */
  showClose?: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  /** true면 primary를 위험(삭제) 스타일로 */
  primaryDanger?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  ariaLabelledBy?: string;
  closeAriaLabel?: string;
};

/** 앱 공통 중앙 모달 (방 생성·공유 결과 등) */
export default function AppModal({
  title,
  lead,
  children,
  onDismiss,
  showClose,
  primaryLabel,
  onPrimary,
  primaryDanger,
  secondaryLabel,
  onSecondary,
  ariaLabelledBy = 'app-modal-title',
  closeAriaLabel = 'close',
}: AppModalProps) {
  const canClose = Boolean(onDismiss);
  const showX = showClose ?? canClose;

  return (
    <div className="app-modal" role="dialog" aria-modal="true" aria-labelledby={ariaLabelledBy}>
      <button
        type="button"
        className="app-modal__backdrop"
        aria-label={closeAriaLabel}
        onClick={onDismiss}
        disabled={!canClose}
      />
      <div className="app-modal__panel">
        {showX && onDismiss ? (
          <button
            type="button"
            className="app-modal__close"
            onClick={onDismiss}
            aria-label={closeAriaLabel}
          >
            <CloseIcon />
          </button>
        ) : null}
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
                className={`app-modal__btn app-modal__btn--primary${primaryDanger ? ' app-modal__btn--danger' : ''}`}
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

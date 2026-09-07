import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppModal from './AppModal';
import { blockUser } from '../utils/blockedUsers';
import {
  REPORT_REASON_IDS,
  submitUgcReport,
  type ReportReasonId,
} from '../utils/ugcReport';
import './RoomSafetyModal.css';

export type SafetyTarget = {
  roomId: string;
  userId: string;
  nickname: string;
  kind: 'user' | 'post' | 'comment';
  postId?: string;
  commentId?: string;
};

type RoomSafetyModalProps = {
  target: SafetyTarget;
  onClose: () => void;
  /** 차단 직후 (목록 새로고침·뒤로가기 등) */
  onBlocked?: (userId: string) => void;
  onDone?: (message: string) => void;
};

type Step = 'menu' | 'report' | 'blockConfirm';

function RoomSafetyModal({ target, onClose, onBlocked, onDone }: RoomSafetyModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReasonId>('spam');
  const [busy, setBusy] = useState(false);

  const name = target.nickname.trim() || t('common.anonymous');

  const finish = (message: string) => {
    onDone?.(message);
    onClose();
  };

  const handleBlock = () => {
    blockUser(target.userId);
    onBlocked?.(target.userId);
    finish(t('rooms.safety.blockedToast', { name }));
  };

  const handleReport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await submitUgcReport({
        roomId: target.roomId,
        targetUserId: target.userId,
        targetNickname: name,
        kind: target.kind,
        reason,
        postId: target.postId,
        commentId: target.commentId,
      });
      finish(t('rooms.safety.reportedToast'));
    } catch {
      finish(t('rooms.safety.reportedToast'));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'report') {
    return (
      <AppModal
        title={t('rooms.safety.reportTitle')}
        lead={t('rooms.safety.reportLead', { name })}
        onDismiss={busy ? undefined : onClose}
        showClose={!busy}
        closeAriaLabel={t('common.close')}
        secondaryLabel={t('common.cancel')}
        onSecondary={() => {
          if (!busy) onClose();
        }}
        primaryLabel={busy ? t('rooms.safety.reporting') : t('rooms.safety.reportSubmit')}
        onPrimary={() => {
          if (!busy) void handleReport();
        }}
      >
        <div className="room-safety__reasons" role="radiogroup" aria-label={t('rooms.safety.reasonAria')}>
          {REPORT_REASON_IDS.map((id) => (
            <label key={id} className="room-safety__reason">
              <input
                type="radio"
                name="ugc-report-reason"
                value={id}
                checked={reason === id}
                disabled={busy}
                onChange={() => setReason(id)}
              />
              <span>{t(`rooms.safety.reasons.${id}`)}</span>
            </label>
          ))}
        </div>
      </AppModal>
    );
  }

  if (step === 'blockConfirm') {
    return (
      <AppModal
        title={t('rooms.safety.blockTitle')}
        lead={t('rooms.safety.blockLead', { name })}
        onDismiss={onClose}
        closeAriaLabel={t('common.close')}
        secondaryLabel={t('common.cancel')}
        onSecondary={onClose}
        primaryDanger
        primaryLabel={t('rooms.safety.blockConfirm')}
        onPrimary={handleBlock}
      />
    );
  }

  return (
    <AppModal
      title={t('rooms.safety.menuTitle')}
      lead={t('rooms.safety.menuLead', { name })}
      onDismiss={onClose}
      closeAriaLabel={t('common.close')}
      secondaryLabel={t('common.cancel')}
      onSecondary={onClose}
    >
      <div className="room-safety__actions">
        <button
          type="button"
          className="room-safety__action"
          onClick={() => setStep('report')}
        >
          {t('rooms.safety.report')}
        </button>
        <button
          type="button"
          className="room-safety__action room-safety__action--danger"
          onClick={() => setStep('blockConfirm')}
        >
          {t('rooms.safety.block')}
        </button>
      </div>
    </AppModal>
  );
}

export default RoomSafetyModal;

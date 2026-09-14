import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CoachBubble from './CoachBubble';
import {
  isWriteFabCoachSeen,
  markWriteFabCoachSeen,
} from '../utils/onboarding';
import './WriteFab.css';

interface WriteFabProps {
  onClick: () => void;
  /** 일기가 없을 때만 첫 작성 코치 표시 */
  showFirstWriteCoach?: boolean;
}

function WriteFab({ onClick, showFirstWriteCoach = false }: WriteFabProps) {
  const { t } = useTranslation();
  const [showCoach, setShowCoach] = useState(
    () => showFirstWriteCoach && !isWriteFabCoachSeen(),
  );

  const dismissCoach = () => {
    markWriteFabCoachSeen();
    setShowCoach(false);
  };

  const handleClick = () => {
    if (showCoach) dismissCoach();
    onClick();
  };

  const coachVisible = showCoach && showFirstWriteCoach;

  return (
    <div className="write-fab-wrap">
      {coachVisible && (
        <CoachBubble
          className="write-fab__coach"
          arrow="bottom-center"
          onDismiss={dismissCoach}
        >
          <p>{t('diary.coach.writeFab')}</p>
        </CoachBubble>
      )}
      <button
        type="button"
        className="write-fab"
        aria-label={t('diary.writeFabAria')}
        onClick={handleClick}
      >
        +
      </button>
    </div>
  );
}

export default WriteFab;

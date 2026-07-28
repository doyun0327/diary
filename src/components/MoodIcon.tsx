import type { Mood } from '../types/diary';
import { getMoodVisual, useMoodPackId } from '../utils/moodPack';
import './MoodIcon.css';

interface MoodIconProps {
  mood: Mood;
  className?: string;
  size?: number;
  decorative?: boolean;
  /** 미리보기용: 특정 팩 강제 (선택 UI) */
  packId?: import('../utils/moodPack').MoodPackId;
}

function MoodIcon({ mood, className = '', size, decorative = true, packId }: MoodIconProps) {
  const activePack = useMoodPackId();
  const visual = getMoodVisual(mood, packId ?? activePack);
  const style = size ? { width: size, height: size } : undefined;

  if (visual.icon) {
    return (
      <img
        className={`mood-icon ${className}`.trim()}
        src={visual.icon}
        alt={decorative ? '' : visual.label}
        aria-hidden={decorative || undefined}
        draggable={false}
        style={style}
      />
    );
  }

  return (
    <span
      className={`mood-icon mood-icon--emoji ${className}`.trim()}
      style={style}
      aria-hidden={decorative || undefined}
    >
      {visual.emoji}
    </span>
  );
}

export default MoodIcon;

import type { Mood } from '../types/diary';
import { getMoodVisual, MOOD_ICON_TRANSFORMS, useMoodPackId } from '../utils/moodPack';
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
  const resolvedPack = packId ?? activePack;
  const visual = getMoodVisual(mood, resolvedPack);
  const transform = MOOD_ICON_TRANSFORMS[resolvedPack]?.[mood];
  const style = {
    ...(size ? { width: size, height: size } : {}),
    ...(transform ? { transform } : {}),
  };

  if (visual.icon) {
    return (
      <img
        className={`mood-icon ${className}`.trim()}
        src={visual.icon}
        alt={decorative ? '' : visual.label}
        aria-hidden={decorative || undefined}
        draggable={false}
        style={Object.keys(style).length > 0 ? style : undefined}
      />
    );
  }

  return (
    <span
      className={`mood-icon mood-icon--emoji ${className}`.trim()}
      style={Object.keys(style).length > 0 ? style : undefined}
      aria-hidden={decorative || undefined}
    >
      {visual.emoji}
    </span>
  );
}

export default MoodIcon;

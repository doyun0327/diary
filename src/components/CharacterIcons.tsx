import type { CharacterProfile } from '../types/character';

const FACE = '#f5d0a9';
const HAIR = '#1a1a1a';

/** 머리 모양 미리보기 */
export function HairStyleIcon({
  style,
  color = HAIR,
}: {
  style: CharacterProfile['hairStyle'];
  color?: string;
}) {
  const c = color;
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden>
      <circle cx="32" cy="36" r="14" fill={FACE} />
      <circle cx="27" cy="35" r="1.6" fill="#5c4033" />
      <circle cx="37" cy="35" r="1.6" fill="#5c4033" />
      <path
        d="M28 41c2 2 6 2 8 0"
        stroke="#c08860"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />

      {style === 'short' && (
        <path d="M18 34c1-14 27-14 28 0v2c-4-8-24-8-28 0z" fill={c} />
      )}
      {style === 'medium' && (
        <>
          <path d="M17 36c1-16 29-16 30 0v4c-5-10-25-10-30 0z" fill={c} />
          <path
            d="M17 38c0 6 2 10 4 12M47 38c0 6-2 10-4 12"
            stroke={c}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {style === 'curly' && (
        <>
          <circle cx="22" cy="24" r="6" fill={c} />
          <circle cx="32" cy="20" r="7" fill={c} />
          <circle cx="42" cy="24" r="6" fill={c} />
          <circle cx="18" cy="32" r="5" fill={c} />
          <circle cx="46" cy="32" r="5" fill={c} />
        </>
      )}
    </svg>
  );
}

/** 미리보기용 고정 머리색 */
export function resolveHairHex(): string {
  return HAIR;
}

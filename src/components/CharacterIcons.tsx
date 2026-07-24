import type { CharacterProfile } from '../types/character';

const FACE = '#f5d0a9';

/** 머리 모양 미리보기 — hairColor로 염색 */
export function HairStyleIcon({
  style,
  color,
}: {
  style: CharacterProfile['hairStyle'];
  color: string;
}) {
  const c = color;
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden>
      <circle cx="32" cy="36" r="14" fill={FACE} />
      <circle cx="27" cy="35" r="1.6" fill="#5c4033" />
      <circle cx="37" cy="35" r="1.6" fill="#5c4033" />
      <path d="M28 41c2 2 6 2 8 0" stroke="#c08860" strokeWidth="1.4" fill="none" strokeLinecap="round" />

      {style === 'short' && (
        <path d="M18 34c1-14 27-14 28 0v2c-4-8-24-8-28 0z" fill={c} />
      )}
      {style === 'medium' && (
        <>
          <path d="M17 36c1-16 29-16 30 0v4c-5-10-25-10-30 0z" fill={c} />
          <path d="M17 38c0 6 2 10 4 12M47 38c0 6-2 10-4 12" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      )}
      {style === 'long' && (
        <>
          <path d="M16 34c2-16 30-16 32 0v6c-6-12-26-12-32 0z" fill={c} />
          <path d="M16 38c0 12 3 20 6 24M48 38c0 12-3 20-6 24" stroke={c} strokeWidth="6" fill="none" strokeLinecap="round" />
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
      {style === 'spiky' && (
        <path
          d="M20 34 L24 18 L28 30 L32 14 L36 30 L40 18 L44 34 C40 26 24 26 20 34Z"
          fill={c}
        />
      )}
      {style === 'two-block' && (
        <>
          <path d="M22 28c2-10 18-10 20 0v2c-4-6-16-6-20 0z" fill={c} />
          <path d="M19 34c1-4 4-6 7-6M45 34c-1-4-4-6-7-6" stroke={c} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {style === 'pigtails' && (
        <>
          <path d="M20 34c2-12 22-12 24 0v2c-4-7-20-7-24 0z" fill={c} />
          <circle cx="14" cy="30" r="6" fill={c} />
          <circle cx="50" cy="30" r="6" fill={c} />
        </>
      )}
      {style === 'bun' && (
        <>
          <path d="M20 34c2-12 22-12 24 0v2c-4-7-20-7-24 0z" fill={c} />
          <circle cx="32" cy="16" r="7" fill={c} />
        </>
      )}
      {style === 'bald' && (
        <path d="M20 32c2-10 22-10 24 0" stroke="#e8c4a0" strokeWidth="3" fill="none" />
      )}
    </svg>
  );
}

/** 머리 색 프리셋 → hex */
export const HAIR_COLOR_HEX: Record<Exclude<CharacterProfile['hairColor'], 'custom'>, string> = {
  black: '#1a1a1a',
  'dark-brown': '#4a2c0a',
};

export function resolveHairHex(profile: Pick<CharacterProfile, 'hairColor' | 'hairHex'>): string {
  if (profile.hairColor === 'custom') return profile.hairHex;
  return HAIR_COLOR_HEX[profile.hairColor];
}

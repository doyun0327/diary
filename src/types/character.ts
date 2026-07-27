export interface CharacterProfile {
  gender: 'boy' | 'girl';
  hairStyle: 'short' | 'medium' | 'curly';
  outfit: 'short-sleeve' | 'dress' | 'hoodie' | 'school-uniform';
}

export const DEFAULT_CHARACTER: CharacterProfile = {
  gender: 'girl',
  hairStyle: 'short',
  outfit: 'short-sleeve',
};

export const GENDER_OPTIONS: { value: CharacterProfile['gender']; label: string }[] = [
  { value: 'boy', label: '남자아이' },
  { value: 'girl', label: '여자아이' },
];

export const HAIR_STYLE_OPTIONS: { value: CharacterProfile['hairStyle']; label: string }[] = [
  { value: 'short', label: '짧은 머리' },
  { value: 'medium', label: '단발' },
  { value: 'curly', label: '뽀글머리' },
];

export const OUTFIT_OPTIONS: { value: CharacterProfile['outfit']; label: string; emoji: string }[] = [
  { value: 'short-sleeve', label: '반팔', emoji: '👕' },
  { value: 'dress', label: '원피스', emoji: '👗' },
  { value: 'hoodie', label: '후드티', emoji: '🧥' },
  { value: 'school-uniform', label: '교복', emoji: '👔' },
];

const GENDER_EN: Record<CharacterProfile['gender'], string> = {
  boy: 'a young boy',
  girl: 'a young girl',
};

const HAIR_STYLE_EN: Record<CharacterProfile['hairStyle'], string> = {
  short: 'short black hair',
  medium: 'shoulder-length black hair',
  curly: 'curly black hair',
};

const OUTFIT_EN: Record<CharacterProfile['outfit'], string> = {
  'short-sleeve': 'a simple short-sleeve shirt',
  dress: 'a simple dress',
  hoodie: 'a hoodie',
  'school-uniform': 'a school uniform',
};

const HAIR_STYLE_FALLBACK: Record<string, CharacterProfile['hairStyle']> = {
  short: 'short',
  medium: 'medium',
  curly: 'curly',
  long: 'medium',
  pigtails: 'curly',
  spiky: 'short',
  'two-block': 'short',
  bun: 'medium',
  bald: 'short',
  bob: 'medium',
  ponytail: 'medium',
  wavy: 'curly',
  'crew-cut': 'short',
  'side-part': 'short',
};

const OUTFIT_FALLBACK: Record<string, CharacterProfile['outfit']> = {
  'short-sleeve': 'short-sleeve',
  dress: 'dress',
  hoodie: 'hoodie',
  'school-uniform': 'school-uniform',
  'long-sleeve': 'short-sleeve',
  overalls: 'short-sleeve',
  'tank-top': 'short-sleeve',
  sportswear: 'hoodie',
  skirt: 'dress',
  raincoat: 'hoodie',
  'blue-shirt': 'short-sleeve',
  'red-shirt': 'short-sleeve',
  'striped-shirt': 'short-sleeve',
  'yellow-hoodie': 'hoodie',
  'green-hoodie': 'hoodie',
  'green-dress': 'dress',
  'pink-dress': 'dress',
  hanbok: 'dress',
  custom: 'short-sleeve',
};

/** 이전 저장 형식도 새 필드로 보정 */
export function normalizeCharacter(
  raw: Partial<CharacterProfile> | (Partial<CharacterProfile> & Record<string, unknown>),
): CharacterProfile {
  const gender =
    raw.gender === 'boy' || raw.gender === 'girl' ? raw.gender : DEFAULT_CHARACTER.gender;

  const rawStyle = typeof raw.hairStyle === 'string' ? raw.hairStyle : undefined;
  const hairStyle =
    (rawStyle && HAIR_STYLE_FALLBACK[rawStyle]) || DEFAULT_CHARACTER.hairStyle;

  const rawOutfit = typeof raw.outfit === 'string' ? raw.outfit : undefined;
  const outfit =
    (rawOutfit && OUTFIT_FALLBACK[rawOutfit]) || DEFAULT_CHARACTER.outfit;

  return { gender, hairStyle, outfit };
}

/** 이미지용 짧은 외형만 (일기 장면이 묻히지 않게 최소화). */
export function describeCharacter(profile: CharacterProfile): string {
  return [
    GENDER_EN[profile.gender],
    HAIR_STYLE_EN[profile.hairStyle],
    `wearing ${OUTFIT_EN[profile.outfit]}`,
  ].join(', ');
}

/** 화면에 보여줄 한글 요약 */
export function summarizeCharacterKo(profile: CharacterProfile): string {
  const gender = GENDER_OPTIONS.find((o) => o.value === profile.gender)?.label ?? '';
  const hair = HAIR_STYLE_OPTIONS.find((o) => o.value === profile.hairStyle)?.label ?? '';
  const outfit = OUTFIT_OPTIONS.find((o) => o.value === profile.outfit)?.label ?? '';
  return [gender, hair, outfit].filter(Boolean).join(' · ');
}

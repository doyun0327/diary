export interface CharacterProfile {
  gender: 'boy' | 'girl';
  hairStyle: 'short' | 'medium' | 'curly' | 'bald';
  outfit: 'short-sleeve' | 'dress' | 'hoodie' | 'school-uniform' | 'swimsuit' | 'ski-suit';
  accessory: 'none' | 'glasses' | 'hat' | 'ribbon';
}

export const DEFAULT_CHARACTER: CharacterProfile = {
  gender: 'girl',
  hairStyle: 'short',
  outfit: 'short-sleeve',
  accessory: 'none',
};

export const GENDER_OPTIONS: { value: CharacterProfile['gender']; label: string }[] = [
  { value: 'boy', label: '남자아이' },
  { value: 'girl', label: '여자아이' },
];

export const HAIR_STYLE_OPTIONS: { value: CharacterProfile['hairStyle']; label: string; emoji: string }[] = [
  { value: 'short', label: '남자머리', emoji: '👦' },
  { value: 'medium', label: '여자머리 단발', emoji: '👩' },
  { value: 'curly', label: '여자머리 파마', emoji: '👩‍🦱' },
  { value: 'bald', label: '대머리', emoji: '🧑‍🦲' },
];

export const OUTFIT_OPTIONS: { value: CharacterProfile['outfit']; label: string; emoji: string }[] = [
  { value: 'short-sleeve', label: '반팔', emoji: '👕' },
  { value: 'dress', label: '원피스', emoji: '👗' },
  { value: 'hoodie', label: '후드티', emoji: '🧥' },
  { value: 'school-uniform', label: '교복', emoji: '👔' },
  { value: 'swimsuit', label: '수영복', emoji: '🩱' },
  { value: 'ski-suit', label: '스키복', emoji: '⛷️' },
];

export const ACCESSORY_OPTIONS: {
  value: CharacterProfile['accessory'];
  label: string;
  emoji: string;
}[] = [
  { value: 'none', label: '없음', emoji: '🚫' },
  { value: 'glasses', label: '안경', emoji: '👓' },
  { value: 'hat', label: '모자', emoji: '🧢' },
  { value: 'ribbon', label: '리본', emoji: '🎀' },
];

const GENDER_EN: Record<CharacterProfile['gender'], string> = {
  boy: 'a young boy',
  girl: 'a young girl',
};

const HAIR_STYLE_EN: Record<CharacterProfile['hairStyle'], string> = {
  short: "short men's haircut",
  medium: "women's bob haircut",
  curly: "women's permed curly hair",
  bald: 'bald head',
};

const OUTFIT_EN: Record<CharacterProfile['outfit'], string> = {
  'short-sleeve': 'a simple short-sleeve shirt',
  dress: 'a simple dress',
  hoodie: 'a hoodie',
  'school-uniform': 'a school uniform',
  swimsuit: 'a swimsuit',
  'ski-suit': 'a ski suit',
};

const ACCESSORY_EN: Record<CharacterProfile['accessory'], string | null> = {
  none: null,
  glasses: 'wearing glasses',
  hat: 'wearing a hat',
  ribbon: 'with a hair ribbon',
};

const HAIR_STYLE_FALLBACK: Record<string, CharacterProfile['hairStyle']> = {
  short: 'short',
  medium: 'medium',
  curly: 'curly',
  bald: 'bald',
  long: 'medium',
  pigtails: 'curly',
  spiky: 'short',
  'two-block': 'short',
  bun: 'medium',
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
  swimsuit: 'swimsuit',
  'ski-suit': 'ski-suit',
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

const ACCESSORY_FALLBACK: Record<string, CharacterProfile['accessory']> = {
  none: 'none',
  glasses: 'glasses',
  hat: 'hat',
  ribbon: 'ribbon',
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

  const rawAccessory = typeof raw.accessory === 'string' ? raw.accessory : undefined;
  const accessory =
    (rawAccessory && ACCESSORY_FALLBACK[rawAccessory]) || DEFAULT_CHARACTER.accessory;

  return { gender, hairStyle, outfit, accessory };
}

/** 이미지용 짧은 외형만 (일기 장면이 묻히지 않게 최소화). */
export function describeCharacter(profile: CharacterProfile): string {
  const parts = [
    GENDER_EN[profile.gender],
    HAIR_STYLE_EN[profile.hairStyle],
    `wearing ${OUTFIT_EN[profile.outfit]}`,
  ];
  const accessory = ACCESSORY_EN[profile.accessory];
  if (accessory) parts.push(accessory);
  return parts.join(', ');
}

/** 화면에 보여줄 한글 요약 */
export function summarizeCharacterKo(profile: CharacterProfile): string {
  const gender = GENDER_OPTIONS.find((o) => o.value === profile.gender)?.label ?? '';
  const hair = HAIR_STYLE_OPTIONS.find((o) => o.value === profile.hairStyle)?.label ?? '';
  const outfit = OUTFIT_OPTIONS.find((o) => o.value === profile.outfit)?.label ?? '';
  const accessory = ACCESSORY_OPTIONS.find((o) => o.value === profile.accessory)?.label ?? '';
  return [gender, hair, outfit, accessory === '없음' ? '' : accessory]
    .filter(Boolean)
    .join(' · ');
}

export interface CharacterProfile {
  gender: 'girl' | 'boy' | 'woman' | 'man';
  hairStyle:
    | 'man-short'
    | 'man-perm'
    | 'woman-bob'
    | 'woman-long'
    | 'woman-perm'
    | 'woman-long-perm'
    | 'ponytail';
  outfit:
    | 'short-sleeve'
    | 'dress'
    | 'hoodie'
    | 'school-uniform'
    | 'swimsuit'
    | 'ski-suit';
  accessory: 'none' | 'glasses' | 'hat' | 'ribbon';
}

export const DEFAULT_CHARACTER: CharacterProfile = {
  gender: 'girl',
  hairStyle: 'woman-bob',
  outfit: 'short-sleeve',
  accessory: 'none',
};

export const GENDER_OPTIONS: { value: CharacterProfile['gender']; label: string }[] = [
  { value: 'girl', label: '여자아이' },
  { value: 'boy', label: '남자아이' },
  { value: 'woman', label: '여자어른' },
  { value: 'man', label: '남자어른' },
];

export const GENDER_EMOJI: Record<CharacterProfile['gender'], string> = {
  girl: '👧🏻',
  boy: '👦🏻',
  woman: '👩🏻',
  man: '👨🏻',
};

export const HAIR_STYLE_OPTIONS: {
  value: CharacterProfile['hairStyle'];
  label: string;
  /** public/hairStyle 상대 경로 */
  image: string;
  gender: 'male' | 'female';
}[] = [
  { value: 'man-short', label: '짧은 스타일', image: '/hairStyle/man-hair.png', gender: 'male' },
  { value: 'man-perm', label: '파마', image: '/hairStyle/man-perm.png', gender: 'male' },
  {
    value: 'woman-bob',
    label: '단발 생머리',
    image: '/hairStyle/woman-shorthair.png',
    gender: 'female',
  },
  {
    value: 'woman-long',
    label: '장발 생머리',
    image: '/hairStyle/woman-longhair.png',
    gender: 'female',
  },
  {
    value: 'woman-perm',
    label: '단발 파마',
    image: '/hairStyle/woman-shortwave.png',
    gender: 'female',
  },
  {
    value: 'woman-long-perm',
    label: '장발 파마',
    image: '/hairStyle/long-wavy-hair-variant.png',
    gender: 'female',
  },
  {
    value: 'ponytail',
    label: '포니테일',
    image: '/hairStyle/woman-ponytail.png',
    gender: 'female',
  },
];

export function isMaleGender(gender: CharacterProfile['gender']): boolean {
  return gender === 'boy' || gender === 'man';
}

export function hairOptionsForGender(gender: CharacterProfile['gender']) {
  const group = isMaleGender(gender) ? 'male' : 'female';
  return HAIR_STYLE_OPTIONS.filter((opt) => opt.gender === group);
}

export function defaultHairForGender(
  gender: CharacterProfile['gender'],
): CharacterProfile['hairStyle'] {
  return isMaleGender(gender) ? 'man-short' : 'woman-bob';
}

export function hairImageForStyle(style: CharacterProfile['hairStyle']): string {
  return (
    HAIR_STYLE_OPTIONS.find((opt) => opt.value === style)?.image ??
    '/hairStyle/woman-shorthair.png'
  );
}

const preloadedHairSrcs = new Set<string>();

/** 캐릭터 시트 헤어 PNG를 미리 올려 첫 오픈 지연을 줄임 */
export function preloadCharacterHairIcons() {
  for (const opt of HAIR_STYLE_OPTIONS) {
    const src = opt.image;
    if (!src || preloadedHairSrcs.has(src)) continue;
    preloadedHairSrcs.add(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }
}

export const OUTFIT_OPTIONS: {
  value: CharacterProfile['outfit'];
  label: string;
  emoji: string;
}[] = [
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
  girl: 'a young girl',
  boy: 'a young boy',
  woman: 'a woman in her twenties',
  man: 'a man in his twenties',
};

function genderPossessive(gender: CharacterProfile['gender']): string {
  switch (gender) {
    case 'girl':
      return "young girl's";
    case 'boy':
      return "young boy's";
    case 'woman':
      return "women's";
    case 'man':
      return "men's";
  }
}

function describeHairStyle(
  style: CharacterProfile['hairStyle'],
  gender: CharacterProfile['gender'],
): string {
  const who = genderPossessive(gender);
  switch (style) {
    case 'man-short':
      return `${who} short haircut`;
    case 'man-perm':
      return `${who} permed curly hair`;
    case 'woman-bob':
      return `${who} short straight bob hair`;
    case 'woman-long':
      return `${who} long straight hair`;
    case 'woman-perm':
      return `${who} short permed curly hair`;
    case 'woman-long-perm':
      return `${who} long permed curly hair`;
    case 'ponytail':
      return `${who} black ponytail hairstyle`;
  }
}

const OUTFIT_EN: Record<CharacterProfile['outfit'], string> = {
  'short-sleeve': 'simple short-sleeve shirt',
  dress: 'simple dress',
  hoodie: 'hoodie',
  'school-uniform': 'school uniform',
  swimsuit: 'swimsuit',
  'ski-suit': 'ski suit',
};

/** 오일파스텔: 한국에서 흔히 보이는 요즘 일상 패션 */
const OUTFIT_EN_OIL_PASTEL: Record<CharacterProfile['outfit'], string> = {
  'short-sleeve':
    'trendy oversized Korean short-sleeve tee tucked casually into high-rise pants, modern Seoul streetwear',
  dress: 'chic Korean midi or shirt dress with a soft silhouette and everyday Seoul style',
  hoodie:
    'oversized Korean streetwear hoodie with relaxed pants and sneakers, trendy K-casual look',
  'school-uniform':
    'realistic modern Korean school uniform (blouse or shirt with skirt or slacks), neat and contemporary',
  swimsuit: 'modern Korean-style swimsuit or resort wear, neat and fashionable',
  'ski-suit': 'stylish modern Korean ski jacket and pants set, sporty and fashionable',
};

function describeOutfit(
  outfit: CharacterProfile['outfit'],
  gender: CharacterProfile['gender'],
  style?: 'webtoonHero' | 'oilPastel' | 'jpRetroFilm' | 'kidSketch' | 'storybook',
): string {
  const who = genderPossessive(gender);
  const base = (style === 'oilPastel' ? OUTFIT_EN_OIL_PASTEL : OUTFIT_EN)[outfit];
  return `wearing a ${who} ${base}`;
}

const ACCESSORY_EN: Record<CharacterProfile['accessory'], string | null> = {
  none: null,
  glasses: 'wearing glasses',
  hat: 'wearing a hat',
  ribbon: 'with a hair ribbon',
};

const ACCESSORY_EN_OIL_PASTEL: Record<CharacterProfile['accessory'], string | null> = {
  none: null,
  glasses: 'wearing stylish thin-frame glasses',
  hat: 'wearing a trendy Korean baseball cap or soft bucket hat',
  ribbon: 'with a cute modern hair ribbon or clip',
};

const HAIR_STYLE_FALLBACK: Record<string, CharacterProfile['hairStyle']> = {
  'man-short': 'man-short',
  'man-perm': 'man-perm',
  'woman-bob': 'woman-bob',
  'woman-long': 'woman-long',
  'woman-perm': 'woman-perm',
  'woman-long-perm': 'woman-long-perm',
  ponytail: 'ponytail',
  // legacy
  short: 'man-short',
  medium: 'woman-bob',
  long: 'woman-long',
  curly: 'woman-perm',
  bald: 'man-short',
  pigtails: 'ponytail',
  spiky: 'man-short',
  'two-block': 'man-short',
  bun: 'woman-bob',
  bob: 'woman-bob',
  wavy: 'woman-perm',
  'crew-cut': 'man-short',
  'side-part': 'man-short',
};

const OUTFIT_FALLBACK: Record<string, CharacterProfile['outfit']> = {
  'short-sleeve': 'short-sleeve',
  'long-sleeve': 'short-sleeve',
  dress: 'dress',
  hoodie: 'hoodie',
  'school-uniform': 'school-uniform',
  swimsuit: 'swimsuit',
  'ski-suit': 'ski-suit',
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

const GENDER_VALUES = new Set<CharacterProfile['gender']>(['girl', 'boy', 'woman', 'man']);

/** 이전 저장 형식도 새 필드로 보정 (pets 등 구 필드는 무시) */
export function normalizeCharacter(
  raw: Partial<CharacterProfile> | (Partial<CharacterProfile> & Record<string, unknown>),
): CharacterProfile {
  const gender =
    typeof raw.gender === 'string' && GENDER_VALUES.has(raw.gender as CharacterProfile['gender'])
      ? (raw.gender as CharacterProfile['gender'])
      : DEFAULT_CHARACTER.gender;

  const rawStyle = typeof raw.hairStyle === 'string' ? raw.hairStyle : undefined;
  let hairStyle =
    (rawStyle && HAIR_STYLE_FALLBACK[rawStyle]) || DEFAULT_CHARACTER.hairStyle;
  const allowedHair = hairOptionsForGender(gender);
  if (!allowedHair.some((opt) => opt.value === hairStyle)) {
    hairStyle = defaultHairForGender(gender);
  }

  const rawOutfit = typeof raw.outfit === 'string' ? raw.outfit : undefined;
  const outfit =
    (rawOutfit && OUTFIT_FALLBACK[rawOutfit]) || DEFAULT_CHARACTER.outfit;

  const rawAccessory = typeof raw.accessory === 'string' ? raw.accessory : undefined;
  const accessory =
    (rawAccessory && ACCESSORY_FALLBACK[rawAccessory]) || DEFAULT_CHARACTER.accessory;

  return { gender, hairStyle, outfit, accessory };
}

/** 이미지용 짧은 외형만 (일기 장면이 묻히지 않게 최소화). */
export function describeCharacter(
  profile: CharacterProfile,
  style?: 'webtoonHero' | 'oilPastel' | 'jpRetroFilm' | 'kidSketch' | 'storybook',
): string {
  const accessories =
    style === 'oilPastel' ? ACCESSORY_EN_OIL_PASTEL : ACCESSORY_EN;
  const child = profile.gender === 'girl' || profile.gender === 'boy';

  const parts = [
    GENDER_EN[profile.gender],
    describeHairStyle(profile.hairStyle, profile.gender),
    describeOutfit(profile.outfit, profile.gender, style),
  ];
  if (style === 'oilPastel') {
    parts.push(
      child
        ? 'dressed in contemporary Korean kids everyday fashion'
        : 'dressed in contemporary Korean everyday fashion',
    );
  }
  const accessory = accessories[profile.accessory];
  if (accessory) parts.push(accessory);

  return parts.join(', ');
}

/** 화면에 보여줄 한글 요약 */
export function summarizeCharacterKo(profile: CharacterProfile): string {
  const gender = GENDER_OPTIONS.find((o) => o.value === profile.gender)?.label ?? '';
  const hair = HAIR_STYLE_OPTIONS.find((o) => o.value === profile.hairStyle)?.label ?? '';
  const outfit = OUTFIT_OPTIONS.find((o) => o.value === profile.outfit)?.label ?? '';
  const accessory = ACCESSORY_OPTIONS.find((o) => o.value === profile.accessory)?.label ?? '';
  const bits = [gender, hair, outfit, accessory === '없음' ? '' : accessory];
  return bits.filter(Boolean).join(' · ');
}

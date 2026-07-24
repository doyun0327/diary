export interface CharacterProfile {
  /** 성별/유형 */
  gender: 'boy' | 'girl' | 'kid';
  /** 피부톤 (색으로 표현 — 인종 호칭 대신) */
  skin: 'light' | 'warm' | 'deep';
  /** 머리 색 (프리셋). custom면 hairHex 사용 */
  hairColor:
    | 'black'
    | 'dark-brown'
    | 'custom';
  /** 머리 직접 색 (hex). hairColor === 'custom'일 때 */
  hairHex: string;
  /** 머리 모양 */
  hairStyle:
    | 'short'
    | 'medium'
    | 'long'
    | 'curly'
    | 'spiky'
    | 'two-block'
    | 'pigtails'
    | 'bun'
    | 'bald';
  /** 옷 */
  outfit:
    | 'dress'
    | 'short-sleeve'
    | 'long-sleeve'
    | 'overalls'
    | 'tank-top'
    | 'hoodie'
    | 'school-uniform'
    | 'sportswear'
    | 'skirt'
    | 'raincoat';
  /** (하위 호환용, UI에서는 사용 안 함) */
  outfitHex: string;
  /** 신발 */
  shoes: 'sneakers' | 'boots' | 'sandals' | 'dress-shoes' | 'rain-boots' | 'barefoot';
  /** 액세서리 (여러 개 가능) */
  accessories: Array<
    | 'none'
    | 'glasses'
    | 'sunglasses'
    | 'hat'
    | 'cap'
    | 'headband'
    | 'ribbon'
    | 'backpack'
    | 'crossbody-bag'
    | 'watch'
    | 'scarf'
    | 'mask'
  >;
  /**
   * 자유 설명 — 칩에 없는 특징을 한국어로 적으면 AI 프롬프트에 포함
   * 예: 주근깨, 강아지 인형, 왼쪽 볼에 점
   */
  customNote: string;
}

export const DEFAULT_CHARACTER: CharacterProfile = {
  gender: 'kid',
  skin: 'warm',
  hairColor: 'black',
  hairHex: '#222222',
  hairStyle: 'short',
  outfit: 'short-sleeve',
  outfitHex: '#4dabf7',
  shoes: 'sneakers',
  accessories: ['none'],
  customNote: '',
};

export const GENDER_OPTIONS: { value: CharacterProfile['gender']; label: string }[] = [
  { value: 'boy', label: '남자아이' },
  { value: 'girl', label: '여자아이' },
  { value: 'kid', label: '아이' },
];

export const SKIN_OPTIONS: { value: CharacterProfile['skin']; label: string }[] = [
  { value: 'light', label: '밝은 피부' },
  { value: 'warm', label: '노란빛 피부' },
  { value: 'deep', label: '짙은 갈색 피부' },
];

export const HAIR_COLOR_OPTIONS: { value: CharacterProfile['hairColor']; label: string }[] = [
  { value: 'black', label: '블랙' },
  { value: 'dark-brown', label: '다크브라운' },
  { value: 'custom', label: '커스텀' },
];

export const HAIR_STYLE_OPTIONS: { value: CharacterProfile['hairStyle']; label: string }[] = [
  { value: 'short', label: '짧은 머리' },
  { value: 'medium', label: '단발' },
  { value: 'long', label: '긴 머리' },
  { value: 'curly', label: '곱슬' },
  { value: 'spiky', label: '스파이키' },
  { value: 'two-block', label: '투블럭' },
  { value: 'pigtails', label: '쌍피그테일' },
  { value: 'bun', label: '묶음머리' },
  { value: 'bald', label: '민머리' },
];

export const OUTFIT_OPTIONS: { value: CharacterProfile['outfit']; label: string; emoji: string }[] = [
  { value: 'dress', label: '원피스', emoji: '👗' },
  { value: 'short-sleeve', label: '반팔', emoji: '👕' },
  { value: 'long-sleeve', label: '긴팔', emoji: '🥼' },
  { value: 'overalls', label: '멜빵바지', emoji: '👖' },
  { value: 'tank-top', label: '나시', emoji: '🎽' },
  { value: 'hoodie', label: '후드티', emoji: '🧥' },
  { value: 'school-uniform', label: '교복', emoji: '👔' },
  { value: 'sportswear', label: '운동복', emoji: '🏃' },
  { value: 'skirt', label: '치마', emoji: '👘' },
  { value: 'raincoat', label: '우비', emoji: '☔' },
];

export const SHOE_OPTIONS: { value: CharacterProfile['shoes']; label: string }[] = [
  { value: 'sneakers', label: '운동화' },
  { value: 'boots', label: '부츠' },
  { value: 'sandals', label: '샌들' },
  { value: 'dress-shoes', label: '구두' },
  { value: 'rain-boots', label: '장화' },
  { value: 'barefoot', label: '맨발' },
];

export const ACCESSORY_OPTIONS: {
  value: CharacterProfile['accessories'][number];
  label: string;
}[] = [
  { value: 'none', label: '없음' },
  { value: 'glasses', label: '안경' },
  { value: 'sunglasses', label: '선글라스' },
  { value: 'hat', label: '모자' },
  { value: 'cap', label: '야구모자' },
  { value: 'headband', label: '머리띠' },
  { value: 'ribbon', label: '리본' },
  { value: 'backpack', label: '가방' },
  { value: 'crossbody-bag', label: '크로스백' },
  { value: 'watch', label: '시계' },
  { value: 'scarf', label: '목도리' },
  { value: 'mask', label: '마스크' },
];

const GENDER_EN: Record<CharacterProfile['gender'], string> = {
  boy: 'a young boy',
  girl: 'a young girl',
  kid: 'a child',
};

/** AI 프롬프트용 — 인종 단어 대신 피부색으로 */
const SKIN_EN: Record<CharacterProfile['skin'], string> = {
  light: 'light fair skin',
  warm: 'warm beige East Asian skin tone',
  deep: 'deep brown dark skin',
};

const HAIR_COLOR_EN: Record<Exclude<CharacterProfile['hairColor'], 'custom'>, string> = {
  black: 'black',
  'dark-brown': 'dark brown',
};

const HAIR_STYLE_EN: Record<CharacterProfile['hairStyle'], string> = {
  short: 'short hair',
  medium: 'shoulder-length hair',
  long: 'long hair',
  curly: 'curly hair',
  spiky: 'spiky short hair',
  'two-block': 'two-block haircut',
  pigtails: 'hair in pigtails',
  bun: 'hair in a bun',
  bald: 'bald head',
};

const OUTFIT_EN: Record<CharacterProfile['outfit'], string> = {
  dress: 'dress',
  'short-sleeve': 'short-sleeve shirt',
  'long-sleeve': 'long-sleeve shirt',
  overalls: 'overalls',
  'tank-top': 'sleeveless tank top',
  hoodie: 'hoodie',
  'school-uniform': 'school uniform',
  sportswear: 'sportswear',
  skirt: 'skirt',
  raincoat: 'raincoat',
};

const ACCESSORY_EN: Record<CharacterProfile['accessories'][number], string> = {
  none: '',
  glasses: 'glasses',
  sunglasses: 'sunglasses',
  hat: 'a hat',
  cap: 'a baseball cap',
  headband: 'a headband',
  ribbon: 'a hair ribbon',
  backpack: 'a backpack',
  'crossbody-bag': 'a crossbody bag',
  watch: 'a wristwatch',
  scarf: 'a scarf',
  mask: 'a face mask',
};

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/** hex → 영어 색 이름 (모델이 #코드보다 이름을 잘 이해함) */
function hexToColorName(hex: string): string {
  const n = hex.replace('#', '');
  if (n.length !== 6) return 'colored';
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);

  const palette: { name: string; r: number; g: number; b: number }[] = [
    { name: 'black', r: 30, g: 30, b: 30 },
    { name: 'brown', r: 120, g: 70, b: 30 },
    { name: 'blonde', r: 220, g: 190, b: 100 },
    { name: 'red', r: 200, g: 50, b: 50 },
    { name: 'pink', r: 240, g: 140, b: 180 },
    { name: 'blue', r: 70, g: 130, b: 230 },
    { name: 'green', r: 60, g: 170, b: 90 },
    { name: 'yellow', r: 240, g: 210, b: 60 },
    { name: 'orange', r: 240, g: 140, b: 40 },
    { name: 'purple', r: 140, g: 80, b: 200 },
    { name: 'white', r: 245, g: 245, b: 245 },
    { name: 'gray', r: 150, g: 150, b: 150 },
  ];

  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.name;
}

/** 이전 저장 형식도 새 필드로 보정 */
export function normalizeCharacter(raw: Partial<CharacterProfile> & Record<string, unknown>): CharacterProfile {
  const legacyHair = typeof raw.hair === 'string' ? raw.hair : undefined;

  let hairColor: CharacterProfile['hairColor'] = DEFAULT_CHARACTER.hairColor;
  let hairStyle: CharacterProfile['hairStyle'] = DEFAULT_CHARACTER.hairStyle;

  const rawHairColor = typeof raw.hairColor === 'string' ? raw.hairColor : undefined;
  if (rawHairColor === 'black' || rawHairColor === 'dark-brown' || rawHairColor === 'custom') {
    hairColor = rawHairColor;
  } else if (rawHairColor === 'brown') {
    hairColor = 'dark-brown';
  } else if (rawHairColor) {
    hairColor = 'custom';
  }

  const validStyles = new Set<string>(HAIR_STYLE_OPTIONS.map((o) => o.value));
  const rawStyle = typeof (raw as { hairStyle?: unknown }).hairStyle === 'string'
    ? ((raw as { hairStyle: string }).hairStyle)
    : undefined;
  const legacyHairStyleMap: Record<string, CharacterProfile['hairStyle']> = {
    bob: 'medium',
    ponytail: 'bun',
    wavy: 'curly',
    'crew-cut': 'short',
    'side-part': 'short',
  };
  if (rawStyle && validStyles.has(rawStyle)) {
    hairStyle = rawStyle as CharacterProfile['hairStyle'];
  } else if (rawStyle && legacyHairStyleMap[rawStyle]) {
    hairStyle = legacyHairStyleMap[rawStyle];
  }

  if (!raw.hairColor && legacyHair) {
    if (legacyHair.includes('brown')) hairColor = 'dark-brown';
    else hairColor = 'black';

    if (legacyHair === 'pigtails') hairStyle = 'pigtails';
    else if (legacyHair === 'long-black') hairStyle = 'long';
    else if (legacyHair === 'short-black') hairStyle = 'short';
    else hairStyle = 'medium';
  }

  const hairHex =
    typeof raw.hairHex === 'string' && isValidHex(raw.hairHex)
      ? raw.hairHex
      : DEFAULT_CHARACTER.hairHex;
  const outfitHex =
    typeof raw.outfitHex === 'string' && isValidHex(raw.outfitHex)
      ? raw.outfitHex
      : DEFAULT_CHARACTER.outfitHex;

  const customNote =
    typeof raw.customNote === 'string' ? raw.customNote.trim().slice(0, 120) : '';

  // 예전 skin 값 → light / warm / deep
  const legacySkin = raw.skin as string | undefined;
  let skin: CharacterProfile['skin'] = DEFAULT_CHARACTER.skin;
  if (legacySkin === 'light' || legacySkin === 'fair') skin = 'light';
  else if (legacySkin === 'warm' || legacySkin === 'medium' || legacySkin === 'tan') skin = 'warm';
  else if (legacySkin === 'deep') skin = 'deep';

  // 예전 outfit → 새 10종
  const validOutfits = new Set<string>(OUTFIT_OPTIONS.map((o) => o.value));
  const rawOutfit = typeof (raw as { outfit?: unknown }).outfit === 'string'
    ? (raw as { outfit: string }).outfit
    : undefined;
  const legacyOutfitMap: Record<string, CharacterProfile['outfit']> = {
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
  let outfit: CharacterProfile['outfit'] = DEFAULT_CHARACTER.outfit;
  if (rawOutfit && validOutfits.has(rawOutfit)) {
    outfit = rawOutfit as CharacterProfile['outfit'];
  } else if (rawOutfit && legacyOutfitMap[rawOutfit]) {
    outfit = legacyOutfitMap[rawOutfit];
  }

  return {
    gender: raw.gender ?? DEFAULT_CHARACTER.gender,
    skin,
    hairColor,
    hairHex,
    hairStyle,
    outfit,
    outfitHex,
    shoes: raw.shoes ?? DEFAULT_CHARACTER.shoes,
    accessories:
      Array.isArray(raw.accessories) && raw.accessories.length > 0
        ? (raw.accessories as CharacterProfile['accessories'])
        : DEFAULT_CHARACTER.accessories,
    customNote,
  };
}

/**
 * 이미지용 짧은 외형만 (일기 장면이 묻히지 않게 최소화).
 */
export function describeCharacter(profile: CharacterProfile): string {
  const hairColorLabel =
    profile.hairColor === 'custom'
      ? hexToColorName(profile.hairHex)
      : HAIR_COLOR_EN[profile.hairColor];

  const hair =
    profile.hairStyle === 'bald'
      ? 'bald head'
      : `${hairColorLabel} ${HAIR_STYLE_EN[profile.hairStyle]}`;

  const outfit = OUTFIT_EN[profile.outfit];

  const accessory = profile.accessories
    .filter((a) => a !== 'none')
    .map((a) => ACCESSORY_EN[a])
    .filter(Boolean)[0];

  const traits = [
    GENDER_EN[profile.gender],
    SKIN_EN[profile.skin],
    hair,
    `wearing a ${outfit}`,
  ];
  if (accessory) traits.push(accessory);

  const note = profile.customNote.trim().slice(0, 40);
  if (note) traits.push(note);

  return traits.join(', ');
}

/** 화면에 보여줄 한글 요약 */
export function summarizeCharacterKo(profile: CharacterProfile): string {
  const gender = GENDER_OPTIONS.find((o) => o.value === profile.gender)?.label ?? '';
  const skin = SKIN_OPTIONS.find((o) => o.value === profile.skin)?.label ?? '';
  const hairColor =
    profile.hairColor === 'custom'
      ? `머리 ${profile.hairHex}`
      : (HAIR_COLOR_OPTIONS.find((o) => o.value === profile.hairColor)?.label ?? '');
  const hairStyle = HAIR_STYLE_OPTIONS.find((o) => o.value === profile.hairStyle)?.label ?? '';
  const outfit = OUTFIT_OPTIONS.find((o) => o.value === profile.outfit)?.label ?? '';
  const shoes = SHOE_OPTIONS.find((o) => o.value === profile.shoes)?.label ?? '';
  const accessories = profile.accessories
    .filter((a) => a !== 'none')
    .map((a) => ACCESSORY_OPTIONS.find((o) => o.value === a)?.label)
    .filter(Boolean);

  const hair = profile.hairStyle === 'bald' ? '민머리' : `${hairColor} ${hairStyle}`;
  const note = profile.customNote.trim() ? `+ ${profile.customNote.trim()}` : '';

  return [gender, skin, hair, outfit, shoes, ...accessories, note]
    .filter(Boolean)
    .join(' · ');
}

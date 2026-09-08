export type PetKind = 'dog' | 'cat';
export type PetColor =
  | 'white'
  | 'black'
  | 'brown'
  | 'cream'
  | 'gray'
  | 'orange'
  | 'spotted';

export interface CharacterPet {
  id: string;
  kind: PetKind;
  color: PetColor;
  /** 이름·품종 등 자유 입력 (선택) */
  note: string;
  /** false면 설정은 유지하고 AI 그림에만 제외 */
  enabled: boolean;
}

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
  /** 반려동물 (최대 MAX_PETS) */
  pets: CharacterPet[];
}

export const MAX_PETS = 3;

export const DEFAULT_CHARACTER: CharacterProfile = {
  gender: 'girl',
  hairStyle: 'woman-bob',
  outfit: 'short-sleeve',
  accessory: 'none',
  pets: [],
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

export const PET_KIND_OPTIONS: {
  value: PetKind;
  label: string;
  emoji: string;
}[] = [
  { value: 'dog', label: '강아지', emoji: '🐶' },
  { value: 'cat', label: '고양이', emoji: '🐱' },
];

export const PET_COLOR_OPTIONS: {
  value: PetColor;
  label: string;
  swatch: string;
}[] = [
  { value: 'white', label: '흰색', swatch: '#f5f5f5' },
  { value: 'black', label: '검정', swatch: '#2a2a2a' },
  { value: 'brown', label: '갈색', swatch: '#8b5a2b' },
  { value: 'cream', label: '크림', swatch: '#f0d9a8' },
  { value: 'gray', label: '회색', swatch: '#9a9a9a' },
  { value: 'orange', label: '주황', swatch: '#e89a3c' },
  {
    value: 'spotted',
    label: '얼룩',
    swatch: 'linear-gradient(135deg, #2a2a2a 45%, #f5f5f5 45%)',
  },
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
  style?: 'storybook' | 'oilPastel',
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

const PET_COLOR_EN: Record<PetColor, string> = {
  white: 'white',
  black: 'black',
  brown: 'brown',
  cream: 'cream-colored',
  gray: 'gray',
  orange: 'orange',
  spotted: 'spotted / bicolor',
};

/** 메모에 자주 쓰는 품종 → 영어 (종류 혼동 완화) */
const PET_BREED_HINTS: { re: RegExp; en: string }[] = [
  { re: /브리티시\s*숏\s*헤어|british\s*shorthair/i, en: 'British Shorthair' },
  { re: /코리안\s*숏\s*헤어|korean\s*shorthair/i, en: 'Korean Shorthair' },
  { re: /스코티시\s*폴드|scottish\s*fold/i, en: 'Scottish Fold' },
  { re: /러시안\s*블루|russian\s*blue/i, en: 'Russian Blue' },
  { re: /페르시안|persian/i, en: 'Persian' },
  { re: /샴|siamese/i, en: 'Siamese' },
  { re: /랙돌|ragdoll/i, en: 'Ragdoll' },
  { re: /먼치킨|munchkin/i, en: 'Munchkin' },
  { re: /노르웨이\s*숲|norwegian\s*forest/i, en: 'Norwegian Forest' },
  { re: /메인\s*쿤|maine\s*coon/i, en: 'Maine Coon' },
  { re: /포메라니안|pomeranian/i, en: 'Pomeranian' },
  { re: /말티즈|maltese/i, en: 'Maltese' },
  { re: /푸들|poodle/i, en: 'Poodle' },
  { re: /비숑|bichon/i, en: 'Bichon Frise' },
  { re: /시바|shiba/i, en: 'Shiba Inu' },
  { re: /코기|corgi/i, en: 'Corgi' },
  { re: /리트리버|retriever/i, en: 'Retriever' },
  { re: /치와와|chihuahua/i, en: 'Chihuahua' },
];

function petBreedHint(note: string): string | null {
  if (!note) return null;
  for (const { re, en } of PET_BREED_HINTS) {
    if (re.test(note)) return en;
  }
  return null;
}

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

const PET_KIND_FALLBACK: Record<string, PetKind> = {
  dog: 'dog',
  cat: 'cat',
};

const PET_COLOR_FALLBACK: Record<string, PetColor> = {
  white: 'white',
  black: 'black',
  brown: 'brown',
  cream: 'cream',
  gray: 'gray',
  grey: 'gray',
  orange: 'orange',
  spotted: 'spotted',
};

const GENDER_VALUES = new Set<CharacterProfile['gender']>(['girl', 'boy', 'woman', 'man']);

const PET_NOTE_MAX = 40;

export function sanitizePetNote(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, PET_NOTE_MAX);
}

export function createPetId(): string {
  return `pet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createPet(kind: PetKind, color: PetColor = 'brown'): CharacterPet {
  return { id: createPetId(), kind, color, note: '', enabled: true };
}

function normalizePet(raw: unknown): CharacterPet | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const kindRaw = typeof obj.kind === 'string' ? obj.kind : typeof obj.type === 'string' ? obj.type : '';
  const kind = PET_KIND_FALLBACK[kindRaw];
  if (!kind) return null;
  const colorRaw = typeof obj.color === 'string' ? obj.color : '';
  const color = PET_COLOR_FALLBACK[colorRaw] || 'brown';
  const id =
    typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : createPetId();
  const enabled = obj.enabled === false ? false : true;
  return {
    id,
    kind,
    color,
    note: sanitizePetNote(obj.note ?? obj.petNote),
    enabled,
  };
}

function migrateLegacyPets(raw: Record<string, unknown>): CharacterPet[] {
  const petRaw = typeof raw.pet === 'string' ? raw.pet : '';
  if (!petRaw || petRaw === 'none') return [];
  const kind = PET_KIND_FALLBACK[petRaw];
  if (!kind) return [];
  const colorRaw = typeof raw.petColor === 'string' ? raw.petColor : '';
  const color = PET_COLOR_FALLBACK[colorRaw] || 'brown';
  return [
    {
      id: createPetId(),
      kind,
      color,
      note: sanitizePetNote(raw.petNote),
      enabled: true,
    },
  ];
}

export function enabledPets(pets: CharacterPet[]): CharacterPet[] {
  return pets.filter((pet) => pet.enabled !== false);
}

/** 이전 저장 형식도 새 필드로 보정 */
export function normalizeCharacter(
  raw: Partial<CharacterProfile> | (Partial<CharacterProfile> & Record<string, unknown>),
): CharacterProfile {
  const record = raw as Record<string, unknown>;
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

  let pets: CharacterPet[] = [];
  if (Array.isArray(raw.pets)) {
    pets = raw.pets
      .map(normalizePet)
      .filter((p): p is CharacterPet => Boolean(p))
      .slice(0, MAX_PETS);
  } else {
    pets = migrateLegacyPets(record);
  }

  return { gender, hairStyle, outfit, accessory, pets };
}

function describePet(pet: CharacterPet): string {
  const note = sanitizePetNote(pet.note);
  const color = PET_COLOR_EN[pet.color];
  const breed = petBreedHint(note);

  // 종류·색을 앞에 — 메모(이름/한글)를 앞에 두면 모델이 개/고양이로 헷갈림
  if (pet.kind === 'cat') {
    const breedBit = breed ? `${breed} ` : '';
    const noteBit = note ? ` (owner notes: "${note}" — nickname/breed hint only)` : '';
    return (
      `a ${color} ${breedBit}house cat` +
      noteBit +
      ' — must draw a real feline cat only; never a dog, puppy, wolf, or fox'
    );
  }

  const breedBit = breed ? `${breed} ` : '';
  const noteBit = note ? ` (owner notes: "${note}" — nickname/breed hint only)` : '';
  return (
    `a ${color} ${breedBit}dog` +
    noteBit +
    ' — must draw a real canine dog only; never a cat, kitten, or feline'
  );
}

/** 이미지용 짧은 외형만 (일기 장면이 묻히지 않게 최소화). */
export function describeCharacter(
  profile: CharacterProfile,
  style?: 'storybook' | 'oilPastel',
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

  if (profile.pets.length > 0) {
    const active = enabledPets(profile.pets);
    if (active.length > 0) {
      const petList = active.map(describePet).join(', and ');
      const hasCat = active.some((p) => p.kind === 'cat');
      const hasDog = active.some((p) => p.kind === 'dog');
      parts.push(
        active.length === 1
          ? `accompanied by ${petList} as their pet — must show this exact animal species`
          : `accompanied by these pets: ${petList} — must show these exact animal species`,
      );
      if (hasCat && !hasDog) {
        parts.push('no dogs in the picture');
      } else if (hasDog && !hasCat) {
        parts.push('no cats in the picture');
      }
    }
  }

  return parts.join(', ');
}

/** 화면에 보여줄 한글 요약 */
export function summarizeCharacterKo(profile: CharacterProfile): string {
  const gender = GENDER_OPTIONS.find((o) => o.value === profile.gender)?.label ?? '';
  const hair = HAIR_STYLE_OPTIONS.find((o) => o.value === profile.hairStyle)?.label ?? '';
  const outfit = OUTFIT_OPTIONS.find((o) => o.value === profile.outfit)?.label ?? '';
  const accessory = ACCESSORY_OPTIONS.find((o) => o.value === profile.accessory)?.label ?? '';
  const bits = [gender, hair, outfit, accessory === '없음' ? '' : accessory];

  const active = enabledPets(profile.pets);
  if (active.length > 0) {
    const petBits = active.map((pet) => {
      const kind = PET_KIND_OPTIONS.find((o) => o.value === pet.kind)?.label ?? '';
      const color = PET_COLOR_OPTIONS.find((o) => o.value === pet.color)?.label ?? '';
      const note = sanitizePetNote(pet.note);
      return [kind, color, note].filter(Boolean).join(' ');
    });
    bits.push(petBits.join(', '));
  }

  return bits.filter(Boolean).join(' · ');
}

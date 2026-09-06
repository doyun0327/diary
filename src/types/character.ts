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
  /** 종류·특징 자유 입력 (선택) */
  note: string;
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
    | 'long-sleeve'
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

export const HAIR_STYLE_OPTIONS: {
  value: CharacterProfile['hairStyle'];
  label: string;
  emoji: string;
}[] = [
  { value: 'man-short', label: '짧은 스타일', emoji: '👨🏻' },
  { value: 'man-perm', label: '파마', emoji: '👨🏻‍🦱' },
  { value: 'woman-bob', label: '단발 생머리', emoji: '👩🏻' },
  { value: 'woman-long', label: '장발 생머리', emoji: '👩🏻‍🦰' },
  { value: 'woman-perm', label: '단발 파마', emoji: '👩🏻‍🦱' },
  { value: 'woman-long-perm', label: '장발 파마', emoji: '👱🏻‍♀️' },
  { value: 'ponytail', label: '포니테일', emoji: '👧🏻' },
];

export const OUTFIT_OPTIONS: {
  value: CharacterProfile['outfit'];
  label: string;
  emoji: string;
}[] = [
  { value: 'short-sleeve', label: '반팔', emoji: '👕' },
  { value: 'long-sleeve', label: '긴팔', emoji: '🥼' },
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

const HAIR_STYLE_EN: Record<CharacterProfile['hairStyle'], string> = {
  'man-short': "short men's haircut",
  'man-perm': "men's permed curly hair",
  'woman-bob': "women's short straight bob hair",
  'woman-long': "women's long straight hair",
  'woman-perm': "women's short permed curly hair",
  'woman-long-perm': "women's long permed curly hair",
  ponytail: "women's ponytail hairstyle",
};

const OUTFIT_EN: Record<CharacterProfile['outfit'], string> = {
  'short-sleeve': 'a simple short-sleeve shirt',
  'long-sleeve': 'a simple long-sleeve shirt',
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

const PET_KIND_EN: Record<PetKind, string> = {
  dog: 'dog',
  cat: 'cat',
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
  'long-sleeve': 'long-sleeve',
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
  return { id: createPetId(), kind, color, note: '' };
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
  return {
    id,
    kind,
    color,
    note: sanitizePetNote(obj.note ?? obj.petNote),
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
    },
  ];
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
  const hairStyle =
    (rawStyle && HAIR_STYLE_FALLBACK[rawStyle]) || DEFAULT_CHARACTER.hairStyle;

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
  const kind = PET_KIND_EN[pet.kind];
  const detail = note ? `${note}, ${color}` : color;
  return `a ${detail} ${kind}`;
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

  if (profile.pets.length > 0) {
    const petList = profile.pets.map(describePet).join(', and ');
    parts.push(
      profile.pets.length === 1
        ? `with ${petList} as a companion pet nearby`
        : `with companion pets nearby: ${petList}`,
    );
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

  if (profile.pets.length > 0) {
    const petBits = profile.pets.map((pet) => {
      const kind = PET_KIND_OPTIONS.find((o) => o.value === pet.kind)?.label ?? '';
      const color = PET_COLOR_OPTIONS.find((o) => o.value === pet.color)?.label ?? '';
      const note = sanitizePetNote(pet.note);
      return [kind, color, note].filter(Boolean).join(' ');
    });
    bits.push(petBits.join(', '));
  }

  return bits.filter(Boolean).join(' · ');
}

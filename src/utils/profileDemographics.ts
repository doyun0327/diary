/** 프로필 성별 · 연령대 (기기 계정) */

export type ProfileGender = 'female' | 'male';
export type ProfileAgeGroup =
  | 'child'
  | 'teens'
  | '20s'
  | '30s'
  | '40plus';

export const PROFILE_GENDERS: ProfileGender[] = ['female', 'male'];
export const PROFILE_AGE_GROUPS: ProfileAgeGroup[] = [
  'child',
  'teens',
  '20s',
  '30s',
  '40plus',
];

export function isProfileGender(v: unknown): v is ProfileGender {
  return v === 'female' || v === 'male';
}

export function isProfileAgeGroup(v: unknown): v is ProfileAgeGroup {
  return (
    v === 'child' ||
    v === 'teens' ||
    v === '20s' ||
    v === '30s' ||
    v === '40plus'
  );
}

/**
 * textOil / 오일 텍스트 프롬프트용 영문 character look.
 * 백엔드 buildOilPastelImagePrompt · isChildLook 과 맞춤.
 */
export function profileLookForAi(
  gender: ProfileGender | null | undefined,
  ageGroup: ProfileAgeGroup | null | undefined,
): string | null {
  if (!gender || !ageGroup) return null;
  const girl = gender === 'female';
  switch (ageGroup) {
    case 'child':
      return girl
        ? 'an elementary-school girl about 9–10 years old'
        : 'an elementary-school boy about 9–10 years old';
    case 'teens':
      return girl ? 'a teenage girl' : 'a teenage boy';
    case '20s':
      return girl ? 'a woman in her twenties' : 'a man in his twenties';
    case '30s':
      return girl ? 'a woman in her thirties' : 'a man in his thirties';
    case '40plus':
      return girl
        ? 'a woman in her forties or older'
        : 'a man in his forties or older';
    default:
      return null;
  }
}

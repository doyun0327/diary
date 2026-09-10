const CHARACTER_DONE_KEY = 'picture-diary-onboarding-character-done';
const CHARACTER_COACH_KEY = 'picture-diary-onboarding-character-coach';
const AI_COACH_KEY = 'picture-diary-onboarding-ai-coach';
const WRITE_FAB_COACH_KEY = 'picture-diary-onboarding-write-fab-coach';
const ROOM_COMMENT_COACH_KEY = 'picture-diary-onboarding-room-comment-coach';
const ROOM_POKE_COACH_KEY = 'picture-diary-onboarding-room-poke-coach';
const PROFILE_DONE_KEY = 'picture-diary-onboarding-profile-done';
const INTRO_DONE_KEY = 'picture-diary-onboarding-intro-done';
/** 레거시 유저 스킵 마이그레이션은 앱 생애 1회만 */
const FLAGS_MIGRATED_KEY = 'picture-diary-onboarding-v2-migrated';
const NICKNAME_KEY = 'picture-diary-nickname';
const ENTRIES_KEY = 'picture-diary-entries';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // ignore
  }
}

function hasStoredNickname(): boolean {
  try {
    return Boolean(localStorage.getItem(NICKNAME_KEY)?.trim());
  } catch {
    return false;
  }
}

function hasStoredDiaryEntries(): boolean {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/**
 * 업데이트 전에 이미 닉네임이 있던 유저만 프로필·소개를 건너뜀.
 * 새로 닉네임을 저장한 직후에는 다시 돌지 않음(1회성).
 */
export function migrateProfileIntroFlags() {
  if (readFlag(FLAGS_MIGRATED_KEY)) return;
  writeFlag(FLAGS_MIGRATED_KEY);
  if (!hasStoredNickname()) return;
  writeFlag(PROFILE_DONE_KEY);
  writeFlag(INTRO_DONE_KEY);
}

/** 이미 일기가 있으면 + 코치는 다시 안 띄움 */
export function migrateWriteFabCoachFlag() {
  if (readFlag(WRITE_FAB_COACH_KEY)) return;
  if (hasStoredDiaryEntries()) writeFlag(WRITE_FAB_COACH_KEY);
}

export function isProfileSetupDone(): boolean {
  migrateProfileIntroFlags();
  return readFlag(PROFILE_DONE_KEY);
}

export function markProfileSetupDone() {
  writeFlag(PROFILE_DONE_KEY);
}

export function isAppIntroDone(): boolean {
  migrateProfileIntroFlags();
  // 첫 실행 소개 슬라이드는 사용하지 않음
  if (!readFlag(INTRO_DONE_KEY)) writeFlag(INTRO_DONE_KEY);
  return true;
}

export function markAppIntroDone() {
  writeFlag(INTRO_DONE_KEY);
}

export function isCharacterSetupDone(): boolean {
  return readFlag(CHARACTER_DONE_KEY);
}

export function markCharacterSetupDone() {
  writeFlag(CHARACTER_DONE_KEY);
}

export function isCharacterCoachSeen(): boolean {
  return readFlag(CHARACTER_COACH_KEY);
}

export function markCharacterCoachSeen() {
  writeFlag(CHARACTER_COACH_KEY);
}

export function isAiCoachSeen(): boolean {
  return readFlag(AI_COACH_KEY);
}

export function markAiCoachSeen() {
  writeFlag(AI_COACH_KEY);
}

export function isWriteFabCoachSeen(): boolean {
  migrateWriteFabCoachFlag();
  return readFlag(WRITE_FAB_COACH_KEY);
}

export function markWriteFabCoachSeen() {
  writeFlag(WRITE_FAB_COACH_KEY);
}

export function isRoomCommentCoachSeen(): boolean {
  return readFlag(ROOM_COMMENT_COACH_KEY);
}

export function markRoomCommentCoachSeen() {
  writeFlag(ROOM_COMMENT_COACH_KEY);
}

export function isRoomPokeCoachSeen(): boolean {
  return readFlag(ROOM_POKE_COACH_KEY);
}

export function markRoomPokeCoachSeen() {
  writeFlag(ROOM_POKE_COACH_KEY);
}

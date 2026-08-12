const CHARACTER_DONE_KEY = 'picture-diary-onboarding-character-done';
const CHARACTER_COACH_KEY = 'picture-diary-onboarding-character-coach';
const AI_COACH_KEY = 'picture-diary-onboarding-ai-coach';
const ROOM_COMMENT_COACH_KEY = 'picture-diary-onboarding-room-comment-coach';
const PROFILE_DONE_KEY = 'picture-diary-onboarding-profile-done';
const INTRO_DONE_KEY = 'picture-diary-onboarding-intro-done';
/** 레거시 유저 스킵 마이그레이션은 앱 생애 1회만 */
const FLAGS_MIGRATED_KEY = 'picture-diary-onboarding-v2-migrated';
const NICKNAME_KEY = 'picture-diary-nickname';

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

export function isProfileSetupDone(): boolean {
  migrateProfileIntroFlags();
  return readFlag(PROFILE_DONE_KEY);
}

export function markProfileSetupDone() {
  writeFlag(PROFILE_DONE_KEY);
}

export function isAppIntroDone(): boolean {
  migrateProfileIntroFlags();
  return readFlag(INTRO_DONE_KEY);
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

export function isRoomCommentCoachSeen(): boolean {
  return readFlag(ROOM_COMMENT_COACH_KEY);
}

export function markRoomCommentCoachSeen() {
  writeFlag(ROOM_COMMENT_COACH_KEY);
}

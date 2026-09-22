import {
  canUseProAiQuota,
  getPurchasedAiPackCredits,
  isPremiumActiveNow,
} from './diaryAccess';

const CHARACTER_DONE_KEY = 'picture-diary-onboarding-character-done';
const CHARACTER_COACH_KEY = 'picture-diary-onboarding-character-coach';
const AI_COACH_KEY = 'picture-diary-onboarding-ai-coach';
/**
 * 어떻게 그릴까요? 튜토리얼 진행
 * - 없음 / "0": 일기 예시 아직
 * - "diary": 일기 예시 봄 → 사진 예시 남음
 * - "1": 완료
 */
const AI_SOURCE_INTRO_KEY = 'picture-diary-onboarding-ai-source-intro';
/** 완성 후 차감 안내 노출 횟수 (최대 3) — 구독·구매권 보유자만 */
const AI_DEDUCT_COACH_COUNT_KEY = 'picture-diary-onboarding-ai-deduct-coach-count';
/** 백그라운드 안내 「×」로 닫음 — 키 버전 올리면 다시 노출 */
const AI_BG_HINT_DISMISSED_KEY = 'picture-diary-onboarding-ai-bg-hint-dismissed-v3';
const WRITE_FAB_COACH_KEY = 'picture-diary-onboarding-write-fab-coach';
/** 홈 오늘 날짜 칸 코치 (문구·위치 개편) */
const TODAY_CELL_COACH_KEY = 'picture-diary-onboarding-today-cell-coach';
const ROOM_COMMENT_COACH_KEY = 'picture-diary-onboarding-room-comment-coach';
const ROOM_POKE_COACH_KEY = 'picture-diary-onboarding-room-poke-coach';
const ROOM_CREATE_COACH_KEY = 'picture-diary-onboarding-room-create-coach';
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

/** 이미 일기가 있으면 오늘 칸 코치도 스킵 */
export function migrateTodayCellCoachFlag() {
  if (readFlag(TODAY_CELL_COACH_KEY)) return;
  if (hasStoredDiaryEntries()) writeFlag(TODAY_CELL_COACH_KEY);
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

/** 그림생성 버튼 첫 안내 — 아직 안 눌렀으면 */
export function shouldShowAiClickCoach(): boolean {
  return !isAiCoachSeen();
}

export function markAiCoachSeen() {
  writeFlag(AI_COACH_KEY);
}

/** 일기→그림 튜토리얼 전부 봤는지 */
export function isAiSourceIntroSeen(): boolean {
  return getAiSourceTutorialProgress() === 'done';
}

export type AiSourceTutorialProgress = 'need-diary' | 'need-photo' | 'done';

export function getAiSourceTutorialProgress(): AiSourceTutorialProgress {
  try {
    const raw = localStorage.getItem(AI_SOURCE_INTRO_KEY);
    if (raw === '1' || raw === 'done') return 'done';
    if (raw === 'diary') return 'need-photo';
    return 'need-diary';
  } catch {
    return 'need-diary';
  }
}

/** 일기 예시(X) 닫음 → 사진 단계로 */
export function markAiSourceDiaryTutorialSeen() {
  try {
    if (getAiSourceTutorialProgress() === 'done') return;
    localStorage.setItem(AI_SOURCE_INTRO_KEY, 'diary');
  } catch {
    // ignore
  }
}

/** 사진 예시까지 완료 */
export function markAiSourceIntroSeen() {
  writeFlag(AI_SOURCE_INTRO_KEY);
}

/** 구독(Pro) 또는 AI 그림충전 구매 잔량이 있으면 true */
function hasPaidAiQuotaForDeductCoach(): boolean {
  return isPremiumActiveNow() || canUseProAiQuota() || getPurchasedAiPackCredits() > 0;
}

/** 완성 후 차감 — 구독·구매권 있는 사람에게만 처음 3번 */
export function shouldShowAiDeductCoach(): boolean {
  if (!hasPaidAiQuotaForDeductCoach()) return false;
  return getAiDeductCoachShowCount() < 3;
}

export function getAiDeductCoachShowCount(): number {
  try {
    const n = Number(localStorage.getItem(AI_DEDUCT_COACH_COUNT_KEY) ?? '0');
    return Number.isFinite(n) && n > 0 ? Math.min(3, Math.floor(n)) : 0;
  } catch {
    return 0;
  }
}

export function markAiDeductCoachShown() {
  try {
    const next = Math.min(3, getAiDeductCoachShowCount() + 1);
    localStorage.setItem(AI_DEDUCT_COACH_COUNT_KEY, String(next));
  } catch {
    // ignore
  }
}

/** 앱을 나가도 그려진다는 안내 — 「그만보기」 전까지 매번 */
export function shouldShowAiBgHint(): boolean {
  return !readFlag(AI_BG_HINT_DISMISSED_KEY);
}

/** 「그만보기」 — 이후 백그라운드 안내 안 띄움 */
export function dismissAiBgHint() {
  writeFlag(AI_BG_HINT_DISMISSED_KEY);
}

export function isWriteFabCoachSeen(): boolean {
  migrateWriteFabCoachFlag();
  return readFlag(WRITE_FAB_COACH_KEY);
}

export function markWriteFabCoachSeen() {
  writeFlag(WRITE_FAB_COACH_KEY);
}

export function isTodayCellCoachSeen(): boolean {
  migrateTodayCellCoachFlag();
  return readFlag(TODAY_CELL_COACH_KEY);
}

export function markTodayCellCoachSeen() {
  writeFlag(TODAY_CELL_COACH_KEY);
  // 레거시 플래그도 같이 닫아 중복 노출 방지
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

export function isRoomCreateCoachSeen(): boolean {
  return readFlag(ROOM_CREATE_COACH_KEY);
}

export function markRoomCreateCoachSeen() {
  writeFlag(ROOM_CREATE_COACH_KEY);
}

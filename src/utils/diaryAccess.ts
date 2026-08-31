export const FREE_ENTRY_GRANT = 5;
/** 무료 회원은 일기 작성·저장 무제한. AI 그림만 횟수 제한 */
export const FREE_ENTRY_LIMIT_ENABLED = false;
export const MONTHLY_DIARY_LIMIT = 50;
export const MONTHLY_PRICE_KRW = 1900;
/** 미구독자 AI 그림 평생 무료 한도 (테스트: 2) */
export const FREE_AI_DRAWS_TOTAL = 2;
/** @deprecated FREE_AI_DRAWS_TOTAL */
export const FREE_AI_DRAWS_PER_DAY = FREE_AI_DRAWS_TOTAL;
/** 광고 보고 AI 그림 1회 (Flutter AdMob 리워드). 배포 앱에서 사용 — 테스트 중 false */
export const AI_REWARD_AD_ENABLED = false;
/** 설치 후 검색·보내기 무료 체험 기간 */
export const FEATURE_TRIAL_DAYS = 7;
const FEATURE_TRIAL_MS = FEATURE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
const FEATURE_TRIAL_START_KEY = "picture-diary-search-export-trial-start-v2";

const STORAGE_KEY = "picture-diary-access-v1";
const ENTRIES_KEY = "picture-diary-entries";

export const SUBSCRIPTION_CHANGE_EVENT = "diary-subscription-change";

let accessAccountId = "guest";

export function setDiaryAccessAccountId(accountId: string) {
  const next = accountId.trim() || "guest";
  if (accessAccountId === next) return;
  // 계정 키 바꾸기 전 premium 보존 (guest→user 전환 시 Pro 상태 유실 방지)
  const prev = loadAccessState();
  accessAccountId = next;
  const state = loadAccessState();
  if (
    prev.premiumUntil &&
    prev.premiumUntil > Date.now() &&
    (!state.premiumUntil || state.premiumUntil < prev.premiumUntil)
  ) {
    state.premiumUntil = prev.premiumUntil;
    saveAccessState(state);
  }
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
}

/** 현재 저장소 기준 Pro 여부 (항상 최신 localStorage) */
export function isPremiumActiveNow(): boolean {
  return getDiaryAccessState().isPremiumActive;
}

function storageKey() {
  return `${STORAGE_KEY}:${accessAccountId}`;
}

type AccessState = {
  premiumUntil: number | null;
  monthlyLimitUsed: number;
  monthKey: string | null;
  aiDrawCredits: number;
  /** 미구독자 평생 무료 AI 그림 사용 횟수 */
  aiFreeDrawsUsed: number;
  /** 광고로 받은 추가 일기 저장 슬롯 (무료 한도 소진 후) */
  bonusDiarySlots: number;
};

export type DiaryAccessStatus = {
  canCreate: boolean;
  remaining: number;
  isPremiumActive: boolean;
  /** Pro 또는 첫 7일 체험 — 검색·보내기 */
  canUseSearchAndExport: boolean;
  monthlyRemaining: number;
  monthlyUsed: number;
  monthlyLimit: number;
  message: string;
};

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function readAiFreeDrawsUsed(
  parsed: Partial<AccessState & { aiDrawUsedToday?: number }>,
) {
  return Math.max(
    0,
    Number(parsed.aiFreeDrawsUsed ?? parsed.aiDrawUsedToday ?? 0),
  );
}

function loadAccessState(): AccessState {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) {
      return {
        premiumUntil: null,
        monthlyLimitUsed: 0,
        monthKey: getMonthKey(),
        aiDrawCredits: 0,
        aiFreeDrawsUsed: 0,
        bonusDiarySlots: 0,
      };
    }

    const parsed = JSON.parse(raw) as Partial<
      AccessState & { adRewardBalance?: number; aiDrawUsedToday?: number }
    >;
    return {
      premiumUntil:
        typeof parsed.premiumUntil === "number" ? parsed.premiumUntil : null,
      monthlyLimitUsed: Number(parsed.monthlyLimitUsed ?? 0),
      monthKey:
        typeof parsed.monthKey === "string" ? parsed.monthKey : getMonthKey(),
      aiDrawCredits: Math.max(0, Number(parsed.aiDrawCredits ?? 0)),
      aiFreeDrawsUsed: readAiFreeDrawsUsed(parsed),
      bonusDiarySlots: Math.max(0, Number(parsed.bonusDiarySlots ?? 0)),
    };
  } catch {
    return {
      premiumUntil: null,
      monthlyLimitUsed: 0,
      monthKey: getMonthKey(),
      aiDrawCredits: 0,
      aiFreeDrawsUsed: 0,
      bonusDiarySlots: 0,
    };
  }
}

function saveAccessState(state: AccessState) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function subscribeDiaryAccess(onStoreChange: () => void) {
  window.addEventListener(SUBSCRIPTION_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(SUBSCRIPTION_CHANGE_EVENT, onStoreChange);
}

function normalizeExpiresAtMs(expiresAt: number | null): number | null {
  if (expiresAt == null || expiresAt <= 0) return null;
  // 초 단위로 오면 ms로 변환
  if (expiresAt < 1_000_000_000_000) return expiresAt * 1000;
  return expiresAt;
}

/** RevenueCat → Flutter → WebView 구독 상태 반영 */
export function applySubscriptionStatus(
  active: boolean,
  expiresAt: number | null,
  productId?: string | null,
) {
  const state = loadAccessState();
  const now = Date.now();
  const until = normalizeExpiresAtMs(expiresAt);
  // Flutter가 active=true 로 보내거나, 활성 구독 productId를 실어 보낼 때만 Pro
  const treatActive =
    active ||
    (typeof productId === "string" &&
      productId.length > 0 &&
      (productId.includes("pageby") ||
        productId.includes("premium") ||
        productId === "pageby_monthly"));

  if (treatActive) {
    state.premiumUntil =
      until != null && until > now
        ? until
        : now + 30 * 24 * 60 * 60 * 1000;
  } else {
    const localValid = Boolean(state.premiumUntil && state.premiumUntil > now);
    // 초기화 전 false / 모호한 inactive 가 유효 Pro를 지우지 않게
    // 만료 시각이 과거로 명시된 경우에만 해제
    if (localValid && (until == null || until > now)) {
      return;
    }
    state.premiumUntil = null;
  }
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
}

export function getStoredDiaryEntryCount() {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** 기기 기준 검색·보내기 체험 시작 시각 (최초 1회 기록) */
function getOrCreateFeatureTrialStart(): number {
  try {
    const raw = localStorage.getItem(FEATURE_TRIAL_START_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    // ignore
  }

  const start = Date.now();
  try {
    localStorage.setItem(FEATURE_TRIAL_START_KEY, String(start));
  } catch {
    // ignore
  }
  return start;
}

/** 검색·보내기 7일 체험 중인지 */
export function isSearchExportTrialActive(): boolean {
  return Date.now() < getOrCreateFeatureTrialStart() + FEATURE_TRIAL_MS;
}

/** Pro 구독 또는 첫 주 체험 */
export function canUseSearchAndExport(): boolean {
  const now = Date.now();
  const state = loadAccessState();
  const isPremium = Boolean(state.premiumUntil && state.premiumUntil > now);
  return isPremium || isSearchExportTrialActive();
}

export function getDiaryAccessState(
  entriesCount = getStoredDiaryEntryCount(),
): DiaryAccessStatus {
  const now = Date.now();
  const state = loadAccessState();
  const monthKey = getMonthKey(new Date(now));

  if (state.monthKey !== monthKey) {
    state.monthKey = monthKey;
    state.monthlyLimitUsed = 0;
    saveAccessState(state);
  }

  const isPremiumActive = Boolean(
    state.premiumUntil && state.premiumUntil > now,
  );
  const searchExportOk = isPremiumActive || isSearchExportTrialActive();

  if (isPremiumActive) {
    const remaining = Math.max(0, MONTHLY_DIARY_LIMIT - state.monthlyLimitUsed);
    return {
      canCreate: remaining > 0,
      remaining,
      isPremiumActive: true,
      canUseSearchAndExport: true,
      monthlyRemaining: remaining,
      monthlyUsed: state.monthlyLimitUsed,
      monthlyLimit: MONTHLY_DIARY_LIMIT,
      message:
        remaining > 0
          ? `Premium: ${remaining} entries left this month.`
          : "Monthly limit of 50 entries reached.",
    };
  }

  if (!FREE_ENTRY_LIMIT_ENABLED) {
    return {
      canCreate: true,
      remaining: Number.MAX_SAFE_INTEGER,
      isPremiumActive: false,
      canUseSearchAndExport: searchExportOk,
      monthlyRemaining: 0,
      monthlyUsed: 0,
      monthlyLimit: 0,
      message: "Free diary limit is temporarily disabled.",
    };
  }

  const freeRemaining = Math.max(0, FREE_ENTRY_GRANT - entriesCount);
  const bonusSlots = Math.max(0, state.bonusDiarySlots);
  const remaining = freeRemaining + bonusSlots;

  return {
    canCreate: remaining > 0,
    remaining,
    isPremiumActive: false,
    canUseSearchAndExport: searchExportOk,
    monthlyRemaining: 0,
    monthlyUsed: Math.min(FREE_ENTRY_GRANT, entriesCount),
    monthlyLimit: FREE_ENTRY_GRANT,
    message:
      remaining > 0
        ? `Free diaries remaining: ${remaining}.`
        : "Free 5 diaries used. Subscribe to keep writing.",
  };
}

export function consumeDiaryUsage() {
  const state = loadAccessState();
  const now = Date.now();
  const monthKey = getMonthKey(new Date(now));

  if (state.monthKey !== monthKey) {
    state.monthKey = monthKey;
    state.monthlyLimitUsed = 0;
  }

  if (state.premiumUntil && state.premiumUntil > now) {
    state.monthlyLimitUsed = Math.max(0, state.monthlyLimitUsed + 1);
    saveAccessState(state);
    window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  }

  return true;
}

export function applyMonthlyUsageFromServer(used: number, yearMonth: string) {
  const state = loadAccessState();
  const monthKey = yearMonth || getMonthKey();
  if (state.monthKey !== monthKey) {
    state.monthKey = monthKey;
    state.monthlyLimitUsed = 0;
  }
  state.monthKey = monthKey;
  state.monthlyLimitUsed = Math.max(0, Math.min(MONTHLY_DIARY_LIMIT, Math.floor(used)));
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
}

function normalizeAiCredits(state: AccessState) {
  state.aiDrawCredits = Math.max(0, state.aiDrawCredits);
  state.aiFreeDrawsUsed = Math.max(0, state.aiFreeDrawsUsed);
}

export function getRemainingFreeAiDraws() {
  const state = loadAccessState();
  normalizeAiCredits(state);
  saveAccessState(state);
  return Math.max(0, FREE_AI_DRAWS_TOTAL - state.aiFreeDrawsUsed);
}

/** @deprecated getRemainingFreeAiDraws */
export function getRemainingFreeAiDrawsToday() {
  return getRemainingFreeAiDraws();
}

export function consumeFreeAiDrawChance() {
  const state = loadAccessState();
  normalizeAiCredits(state);
  if (state.aiFreeDrawsUsed >= FREE_AI_DRAWS_TOTAL) return false;
  state.aiFreeDrawsUsed += 1;
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  return true;
}

export function getAiDrawCredits() {
  const state = loadAccessState();
  normalizeAiCredits(state);
  saveAccessState(state);
  return state.aiDrawCredits;
}

export function grantAiDrawCredits(count = 1) {
  const state = loadAccessState();
  normalizeAiCredits(state);
  state.aiDrawCredits = Math.max(0, state.aiDrawCredits + Math.max(0, count));
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  return state.aiDrawCredits;
}

export function consumeAiDrawCredit() {
  const state = loadAccessState();
  normalizeAiCredits(state);
  if (state.aiDrawCredits <= 0) return false;
  state.aiDrawCredits -= 1;
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  return true;
}

/** 광고 시청 후 무료 한도 초과해도 일기 1편 저장 가능 */
export function grantBonusDiarySlots(count = 1) {
  const state = loadAccessState();
  state.bonusDiarySlots = Math.max(
    0,
    state.bonusDiarySlots + Math.max(0, count),
  );
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  return state.bonusDiarySlots;
}

/** 저장 시 무료 기본 한도를 넘는 경우 보너스 슬롯 1개 소모 */
export function consumeBonusDiarySlotIfNeeded(entriesCount: number) {
  const freeRemaining = Math.max(0, FREE_ENTRY_GRANT - entriesCount);
  if (freeRemaining > 0) return true;
  const state = loadAccessState();
  if (state.bonusDiarySlots <= 0) return false;
  state.bonusDiarySlots -= 1;
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  return true;
}

/** @deprecated RevenueCat ???????? ???. ????? mock?? ????? ?? ??? */
export function buyMonthlyPlan() {
  applySubscriptionStatus(true, Date.now() + 30 * 24 * 60 * 60 * 1000);
  return true;
}

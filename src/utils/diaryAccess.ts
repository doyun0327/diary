export const FREE_ENTRY_GRANT = 5;
/** true면 무료 5장 이후 신규 작성 시 구독 필요 */
export const FREE_ENTRY_LIMIT_ENABLED = true;
export const MONTHLY_DIARY_LIMIT = 50;
export const MONTHLY_PRICE_KRW = 1900;
export const FREE_AI_DRAWS_PER_DAY = 2;
/** 광고 보고 AI 그림 1회 (Flutter AdMob 리워드). 배포 앱에서 사용 */
export const AI_REWARD_AD_ENABLED = true;

const STORAGE_KEY = "picture-diary-access-v1";
const ENTRIES_KEY = "picture-diary-entries";

export const SUBSCRIPTION_CHANGE_EVENT = "diary-subscription-change";

let accessAccountId = "guest";

export function setDiaryAccessAccountId(accountId: string) {
  const next = accountId.trim() || "guest";
  if (accessAccountId === next) return;
  accessAccountId = next;
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
}

function storageKey() {
  return `${STORAGE_KEY}:${accessAccountId}`;
}

type AccessState = {
  premiumUntil: number | null;
  monthlyLimitUsed: number;
  monthKey: string | null;
  aiDrawCredits: number;
  aiCreditDayKey: string | null;
  aiDrawUsedToday: number;
};

export type DiaryAccessStatus = {
  canCreate: boolean;
  remaining: number;
  isPremiumActive: boolean;
  monthlyRemaining: number;
  monthlyUsed: number;
  monthlyLimit: number;
  message: string;
};

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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
        aiCreditDayKey: getDayKey(),
        aiDrawUsedToday: 0,
      };
    }

    const parsed = JSON.parse(raw) as Partial<
      AccessState & { adRewardBalance?: number }
    >;
    return {
      premiumUntil:
        typeof parsed.premiumUntil === "number" ? parsed.premiumUntil : null,
      monthlyLimitUsed: Number(parsed.monthlyLimitUsed ?? 0),
      monthKey:
        typeof parsed.monthKey === "string" ? parsed.monthKey : getMonthKey(),
      aiDrawCredits: Math.max(0, Number(parsed.aiDrawCredits ?? 0)),
      aiCreditDayKey:
        typeof parsed.aiCreditDayKey === "string"
          ? parsed.aiCreditDayKey
          : getDayKey(),
      aiDrawUsedToday: Math.max(0, Number(parsed.aiDrawUsedToday ?? 0)),
    };
  } catch {
    return {
      premiumUntil: null,
      monthlyLimitUsed: 0,
      monthKey: getMonthKey(),
      aiDrawCredits: 0,
      aiCreditDayKey: getDayKey(),
      aiDrawUsedToday: 0,
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

/** RevenueCat ?? Flutter ?? WebView ???? ???? ??? */
export function applySubscriptionStatus(
  active: boolean,
  expiresAt: number | null,
) {
  const state = loadAccessState();
  if (active) {
    state.premiumUntil =
      expiresAt && expiresAt > Date.now()
        ? expiresAt
        : Date.now() + 30 * 24 * 60 * 60 * 1000;
  } else {
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

  if (isPremiumActive) {
    const remaining = Math.max(0, MONTHLY_DIARY_LIMIT - state.monthlyLimitUsed);
    return {
      canCreate: remaining > 0,
      remaining,
      isPremiumActive: true,
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
      monthlyRemaining: 0,
      monthlyUsed: 0,
      monthlyLimit: 0,
      message: "Free diary limit is temporarily disabled.",
    };
  }

  const freeRemaining = Math.max(0, FREE_ENTRY_GRANT - entriesCount);

  return {
    canCreate: freeRemaining > 0,
    remaining: freeRemaining,
    isPremiumActive: false,
    monthlyRemaining: 0,
    monthlyUsed: Math.min(FREE_ENTRY_GRANT, entriesCount),
    monthlyLimit: FREE_ENTRY_GRANT,
    message:
      freeRemaining > 0
        ? `Free diaries remaining: ${freeRemaining}.`
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

function normalizeAiCreditDay(state: AccessState) {
  const dayKey = getDayKey();
  if (state.aiCreditDayKey !== dayKey) {
    state.aiCreditDayKey = dayKey;
    state.aiDrawCredits = 0;
    state.aiDrawUsedToday = 0;
  }
}

export function getRemainingFreeAiDrawsToday() {
  const state = loadAccessState();
  normalizeAiCreditDay(state);
  saveAccessState(state);
  return Math.max(0, FREE_AI_DRAWS_PER_DAY - state.aiDrawUsedToday);
}

export function consumeFreeAiDrawChance() {
  const state = loadAccessState();
  normalizeAiCreditDay(state);
  if (state.aiDrawUsedToday >= FREE_AI_DRAWS_PER_DAY) return false;
  state.aiDrawUsedToday += 1;
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  return true;
}

export function getAiDrawCredits() {
  const state = loadAccessState();
  normalizeAiCreditDay(state);
  saveAccessState(state);
  return state.aiDrawCredits;
}

export function grantAiDrawCredits(count = 1) {
  const state = loadAccessState();
  normalizeAiCreditDay(state);
  state.aiDrawCredits = Math.max(0, state.aiDrawCredits + Math.max(0, count));
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  return state.aiDrawCredits;
}

export function consumeAiDrawCredit() {
  const state = loadAccessState();
  normalizeAiCreditDay(state);
  if (state.aiDrawCredits <= 0) return false;
  state.aiDrawCredits -= 1;
  saveAccessState(state);
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT));
  return true;
}

/** @deprecated RevenueCat ???????? ???. ????? mock?? ????? ?? ??? */
export function buyMonthlyPlan() {
  applySubscriptionStatus(true, Date.now() + 30 * 24 * 60 * 60 * 1000);
  return true;
}

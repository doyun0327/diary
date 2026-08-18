export const FREE_ENTRY_GRANT = 5;
export const MONTHLY_DIARY_LIMIT = 50;
export const MONTHLY_PRICE_KRW = 2900;
export const FREE_AI_DRAWS_PER_DAY = 2;

const STORAGE_KEY = "picture-diary-access-v1";
const ENTRIES_KEY = "picture-diary-entries";

export const SUBSCRIPTION_CHANGE_EVENT = "diary-subscription-change";

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
  message: string;
};

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function getDayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function loadAccessState(): AccessState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      message:
        remaining > 0
          ? "?? ?????? ??????? ??? ??? ?? ?? ?? ????."
          : "??? ?? 50?? ???X?? ??? ????????. ???? ??? ??? ????? ?? ????.",
    };
  }

  const freeRemaining = Math.max(0, FREE_ENTRY_GRANT - entriesCount);

  return {
    canCreate: freeRemaining > 0,
    remaining: freeRemaining,
    isPremiumActive: false,
    monthlyRemaining: 0,
    message:
      freeRemaining > 0
        ? `???? ??? ${freeRemaining}???? ?? ?? ?? ????.`
        : "???? 5???? ??? ???????. ?? ???? ?? ??? ????? ?? ????.",
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
  }

  return true;
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

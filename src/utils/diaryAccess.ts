export const FREE_ENTRY_GRANT = 5;
export const MONTHLY_DIARY_LIMIT = 50;
export const MONTHLY_PRICE_KRW = 3300;

const STORAGE_KEY = "picture-diary-access-v1";
const ENTRIES_KEY = "picture-diary-entries";

export const SUBSCRIPTION_CHANGE_EVENT = "diary-subscription-change";

type AccessState = {
  premiumUntil: number | null;
  monthlyLimitUsed: number;
  monthKey: string | null;
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

function loadAccessState(): AccessState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        premiumUntil: null,
        monthlyLimitUsed: 0,
        monthKey: getMonthKey(),
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
    };
  } catch {
    return {
      premiumUntil: null,
      monthlyLimitUsed: 0,
      monthKey: getMonthKey(),
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

/** RevenueCat → Flutter → WebView 구독 상태 반영 */
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
          ? "월 구독이 활성화되어 있어 일기를 더 쓸 수 있어요."
          : "이번 달 50장 사용량을 모두 소진했어요. 다음 달에 다시 이용할 수 있어요.",
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
        ? `무료 일기 ${freeRemaining}장을 더 쓸 수 있어요.`
        : "무료 5장을 모두 사용했어요. 월 구독 후 계속 작성할 수 있어요.",
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

/** @deprecated RevenueCat 구독으로 대체. 개발용 mock만 필요할 때 사용 */
export function buyMonthlyPlan() {
  applySubscriptionStatus(true, Date.now() + 30 * 24 * 60 * 60 * 1000);
  return true;
}

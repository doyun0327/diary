export const FREE_ENTRY_GRANT = 5;
export const MONTHLY_DIARY_LIMIT = 50;
export const MONTHLY_PRICE_KRW = 3990;

const STORAGE_KEY = "picture-diary-access-v1";
const ENTRIES_KEY = "picture-diary-entries";

type AccessState = {
  adRewardBalance: number;
  premiumUntil: number | null;
  monthlyLimitUsed: number;
  monthKey: string | null;
};

export type DiaryAccessStatus = {
  canCreate: boolean;
  remaining: number;
  isPremiumActive: boolean;
  rewardBalance: number;
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
        adRewardBalance: 0,
        premiumUntil: null,
        monthlyLimitUsed: 0,
        monthKey: getMonthKey(),
      };
    }

    const parsed = JSON.parse(raw) as Partial<AccessState>;
    return {
      adRewardBalance: Number(parsed.adRewardBalance ?? 0),
      premiumUntil:
        typeof parsed.premiumUntil === "number" ? parsed.premiumUntil : null,
      monthlyLimitUsed: Number(parsed.monthlyLimitUsed ?? 0),
      monthKey:
        typeof parsed.monthKey === "string" ? parsed.monthKey : getMonthKey(),
    };
  } catch {
    return {
      adRewardBalance: 0,
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
      rewardBalance: state.adRewardBalance,
      monthlyRemaining: remaining,
      message:
        remaining > 0
          ? "월 구독 플랜이 활성화되어 있어 추가 생성이 가능합니다."
          : "이번 달 50장 사용량을 모두 소진했습니다. 다음 달에 다시 이용할 수 있습니다.",
    };
  }

  const rewardBalance = Math.max(0, state.adRewardBalance);
  const freeRemaining = Math.max(
    0,
    FREE_ENTRY_GRANT + rewardBalance - entriesCount,
  );

  return {
    canCreate: freeRemaining > 0,
    remaining: freeRemaining,
    isPremiumActive: false,
    rewardBalance,
    monthlyRemaining: 0,
    message:
      freeRemaining > 0
        ? `무료 생성 가능 횟수 ${freeRemaining}장 남았습니다.`
        : "신규 5장 무료 혜택을 모두 사용했어요. 광고를 보고 1장을 무료로 받거나 월 구독을 이용해 주세요.",
  };
}

export function watchAdForOneFreeEntry() {
  const state = loadAccessState();
  state.adRewardBalance = Math.max(0, state.adRewardBalance + 1);
  saveAccessState(state);
  return true;
}

export function buyMonthlyPlan() {
  const state = loadAccessState();
  state.premiumUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
  state.monthKey = getMonthKey();
  state.monthlyLimitUsed = 0;
  saveAccessState(state);
  return true;
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
    return true;
  }

  if (state.adRewardBalance > 0) {
    state.adRewardBalance = Math.max(0, state.adRewardBalance - 1);
    saveAccessState(state);
    return true;
  }

  saveAccessState(state);
  return true;
}

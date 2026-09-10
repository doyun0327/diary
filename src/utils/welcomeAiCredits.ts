import { claimWelcomeAiPackCredits } from '../api/usageApi';
import { getAccessToken, isGoogleSignedIn } from '../hooks/useAuthSession';
import { applyAiPackCreditsFromServer } from './diaryAccess';

/**
 * Google 연동 계정에 무료 AI 3회 청구 (서버 계정당 1회).
 * 이미 받았으면 잔여만 동기화.
 */
export async function claimWelcomeAiCredits(): Promise<number> {
  if (!isGoogleSignedIn()) return 0;
  const token = getAccessToken();
  if (!token) return 0;

  try {
    const view = await claimWelcomeAiPackCredits(token);
    applyAiPackCreditsFromServer(view.credits);
    return view.credits;
  } catch (err) {
    console.warn('[ai] welcome claim failed', err);
    return 0;
  }
}

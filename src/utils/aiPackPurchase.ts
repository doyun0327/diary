import { isFlutterApp } from './nativeShare';
import {
  aiPackCreditsForProduct,
  type AiPackProductId,
} from './aiPackProducts';
import {
  applyAiPackCreditsFromServer,
  grantAiPackCredits,
} from './diaryAccess';
import { getAccessToken, isGoogleSignedIn } from '../hooks/useAuthSession';
import { grantAiPackCreditsRemote, recordPurchaseRemote } from '../api/usageApi';
import {
  waitForTipPurchase,
  type TipPurchaseResult,
} from './tipPurchase';

/** 앱에서 AI 추가 구매 (츄르와 동일 tipPurchase 채널). Google 회원만. */
export async function purchaseAiPack(
  productId: AiPackProductId,
): Promise<TipPurchaseResult & { creditsGranted?: number }> {
  if (!isGoogleSignedIn()) {
    return { ok: false, productId, error: 'need_google' };
  }
  if (!isFlutterApp()) {
    return { ok: false, productId, error: 'app_only' };
  }
  const result = await waitForTipPurchase(productId);
  if (!result.ok) return result;
  const credits = aiPackCreditsForProduct(result.productId || productId);
  if (credits > 0) {
    const token = getAccessToken();
    const product = result.productId || productId;
    if (token) {
      try {
        const view = await grantAiPackCreditsRemote(token, credits, product);
        applyAiPackCreditsFromServer(view.credits);
      } catch {
        // 서버 실패 시 로컬이라도 지급 (재동기화 시 보정)
        grantAiPackCredits(credits);
        try {
          await recordPurchaseRemote(token, {
            kind: 'ai_pack',
            productId: product,
            creditsGranted: credits,
          });
        } catch (err) {
          console.warn('[aiPack] purchase history save failed', err);
        }
      }
    } else {
      grantAiPackCredits(credits);
    }
  }
  return { ...result, creditsGranted: credits };
}

/** 테스트·웹 미리보기용 — 네이티브 없이 크레딧만 지급 */
export function grantAiPackLocally(productId: AiPackProductId) {
  const credits = aiPackCreditsForProduct(productId);
  if (credits > 0) grantAiPackCredits(credits);
  return credits;
}

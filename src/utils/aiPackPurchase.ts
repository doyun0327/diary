import { isFlutterApp, postDiaryNative } from './nativeShare';
import {
  aiPackCreditsForProduct,
  type AiPackProductId,
} from './aiPackProducts';
import { grantAiPackCredits } from './diaryAccess';
import {
  waitForTipPurchase,
  type TipPurchaseResult,
} from './tipPurchase';

/** 앱에서 AI 추가 구매 (츄르와 동일 tipPurchase 채널) */
export async function purchaseAiPack(
  productId: AiPackProductId,
): Promise<TipPurchaseResult & { creditsGranted?: number }> {
  if (!isFlutterApp()) {
    return { ok: false, productId, error: 'app_only' };
  }
  const result = await waitForTipPurchase(productId);
  if (!result.ok) return result;
  const credits = aiPackCreditsForProduct(result.productId || productId);
  if (credits > 0) {
    grantAiPackCredits(credits);
  }
  return { ...result, creditsGranted: credits };
}

/** 테스트·웹 미리보기용 — 네이티브 없이 크레딧만 지급 */
export function grantAiPackLocally(productId: AiPackProductId) {
  const credits = aiPackCreditsForProduct(productId);
  if (credits > 0) grantAiPackCredits(credits);
  return credits;
}

export { postDiaryNative };

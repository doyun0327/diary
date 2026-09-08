import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AI_PACK_PRODUCTS, type AiPackProductId } from '../utils/aiPackProducts';
import { purchaseAiPack } from '../utils/aiPackPurchase';
import {
  getAiPackCredits,
  getDiaryAccessState,
  MONTHLY_AI_DRAW_LIMIT,
  subscribeDiaryAccess,
} from '../utils/diaryAccess';
import { isFlutterApp } from '../utils/nativeShare';
import {
  requestSubscriptionPurchaseAndSync,
  requestSubscriptionRestore,
} from '../utils/subscription';
import CloseIcon from './CloseIcon';
import './AccountSheet.css';
import './NyangTicketSheet.css';

type TabId = 'subscribe' | 'packs';

interface NyangTicketSheetProps {
  onClose: () => void;
  /** 열릴 때 기본 탭 */
  initialTab?: TabId;
}

function NyangTicketSheet({ onClose, initialTab = 'subscribe' }: NyangTicketSheetProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [accessTick, setAccessTick] = useState(0);
  const [busy, setBusy] = useState<'sub' | AiPackProductId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => subscribeDiaryAccess(() => setAccessTick((n) => n + 1)), []);

  useEffect(() => {
    setMessage(null);
    setError(null);
  }, [tab]);

  // 눈에 보이는 복원 버튼 없이, 시트 열릴 때 백그라운드에서 구독 상태 맞춤
  useEffect(() => {
    if (!isFlutterApp()) return;
    requestSubscriptionRestore();
  }, []);

  void accessTick;
  const access = getDiaryAccessState();
  const packLeft = getAiPackCredits();
  const isPro = access.isPremiumActive;
  const subLeft = Math.max(0, access.monthlyRemaining);

  const handleSubscribe = async () => {
    if (busy) return;
    setMessage(null);
    setError(null);
    if (!isFlutterApp()) {
      setError(t('subscription.appOnly'));
      return;
    }
    setBusy('sub');
    try {
      const ok = await requestSubscriptionPurchaseAndSync();
      if (ok) {
        setMessage(t('nyangTicket.subscribeDone'));
      }
    } finally {
      setBusy(null);
    }
  };

  /** 숨김: 제목 길게 누르기 → 수동 복원 */
  const handleHiddenRestore = () => {
    if (!isFlutterApp() || busy) return;
    requestSubscriptionRestore();
    setMessage(t('nyangTicket.restoreStarted'));
  };

  const handleBuyPack = async (productId: AiPackProductId) => {
    if (busy) return;
    setMessage(null);
    setError(null);
    if (!isFlutterApp()) {
      setError(t('nyangTicket.appOnly'));
      return;
    }
    setBusy(productId);
    try {
      const result = await purchaseAiPack(productId);
      if (result.cancelled) return;
      if (result.ok) {
        setMessage(
          t('nyangTicket.packDone', {
            n: result.creditsGranted ?? aiPackCreditsLabel(productId),
          }),
        );
        return;
      }
      if (result.error === 'app_only') {
        setError(t('nyangTicket.appOnly'));
        return;
      }
      if (result.error === 'no_product') {
        setError(t('nyangTicket.noProduct'));
        return;
      }
      setError(t('nyangTicket.buyFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="account-sheet" role="dialog" aria-label={t('nyangTicket.aria')}>
      <div className="account-sheet__backdrop" onClick={onClose} />
      <div className="account-sheet__panel nyang-ticket">
        <header className="account-sheet__head nyang-ticket__head">
          <div className="nyang-ticket__head-text">
            <h2
              onContextMenu={(e) => {
                e.preventDefault();
                handleHiddenRestore();
              }}
              onPointerDown={(e) => {
                if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                  const timer = window.setTimeout(() => {
                    handleHiddenRestore();
                  }, 900);
                  const clear = () => {
                    window.clearTimeout(timer);
                    window.removeEventListener('pointerup', clear);
                    window.removeEventListener('pointercancel', clear);
                  };
                  window.addEventListener('pointerup', clear);
                  window.addEventListener('pointercancel', clear);
                }
              }}
            >
              {t('nyangTicket.title')}
            </h2>
            <p className="nyang-ticket__head-lead">
              {tab === 'subscribe'
                ? t('nyangTicket.subscribeLead', { n: MONTHLY_AI_DRAW_LIMIT })
                : t('nyangTicket.packsLead')}
            </p>
          </div>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="nyang-ticket__tabs" role="tablist" aria-label={t('nyangTicket.tabsAria')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'subscribe'}
            className={tab === 'subscribe' ? 'is-active' : ''}
            onClick={() => setTab('subscribe')}
          >
            {isPro
              ? t('nyangTicket.subscribeTitleWithLeft', { n: subLeft })
              : t('nyangTicket.subscribeTitle')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'packs'}
            className={tab === 'packs' ? 'is-active' : ''}
            onClick={() => setTab('packs')}
          >
            {packLeft > 0
              ? t('nyangTicket.packsTitleWithLeft', { n: packLeft })
              : t('nyangTicket.packsTitle')}
          </button>
        </div>

        {tab === 'subscribe' && (
          <section className="account-sheet__block nyang-ticket__panel" role="tabpanel">
            <button
              type="button"
              className="account-sheet__btn account-sheet__btn--solid nyang-ticket__btn"
              disabled={busy != null || isPro}
              onClick={() => void handleSubscribe()}
            >
              {busy === 'sub'
                ? t('common.processing')
                : isPro
                  ? t('nyangTicket.subscribed')
                  : t('nyangTicket.subscribeCta')}
            </button>
          </section>
        )}

        {tab === 'packs' && (
          <section className="account-sheet__block nyang-ticket__panel" role="tabpanel">
            <ul className="nyang-ticket__packs">
              {AI_PACK_PRODUCTS.map((pack) => (
                <li key={pack.id}>
                  <button
                    type="button"
                    className="nyang-ticket__pack-btn"
                    disabled={busy != null}
                    onClick={() => void handleBuyPack(pack.id)}
                  >
                    <span className="nyang-ticket__pack-name">
                      {t('nyangTicket.packLabel', { n: pack.credits })}
                    </span>
                    <span className="nyang-ticket__pack-cta">
                      {busy === pack.id
                        ? t('common.processing')
                        : t('nyangTicket.buy')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {message && (
          <p className="nyang-ticket__msg" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="nyang-ticket__err" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function aiPackCreditsLabel(productId: AiPackProductId): number {
  return AI_PACK_PRODUCTS.find((p) => p.id === productId)?.credits ?? 0;
}

export default NyangTicketSheet;

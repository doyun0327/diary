import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchPurchaseRecords,
  recordPurchaseRemote,
  type PurchaseRecordDto,
} from '../api/usageApi';
import { AI_PACK_PRODUCTS, type AiPackProductId } from '../utils/aiPackProducts';
import { purchaseAiPack } from '../utils/aiPackPurchase';
import {
  getAiPackCredits,
  getDiaryAccessState,
  subscribeDiaryAccess,
} from '../utils/diaryAccess';
import { isFlutterApp } from '../utils/nativeShare';
import {
  REQUIRE_GOOGLE_FOR_PRO_EVENT,
  requestSubscriptionPurchaseAndSync,
  requestSubscriptionRestore,
} from '../utils/subscription';
import {
  clearPendingNyangPurchase,
  setPendingNyangPurchase,
  type PendingNyangPurchase,
} from '../utils/pendingNyangPurchase';
import { getAccessToken, isGoogleSignedIn, useAuthSession } from '../hooks/useAuthSession';
import { requestNativeGoogleSignIn } from '../lib/googleAuth';
import CloseIcon from './CloseIcon';
import './AccountSheet.css';
import './NyangTicketSheet.css';

type TabId = 'subscribe' | 'packs' | 'history';
type BusyState = 'sub' | 'google' | AiPackProductId | null;

const SUB_PRODUCT_ID = 'pageby_monthly';

interface NyangTicketSheetProps {
  onClose: () => void;
  /** 열릴 때 기본 탭 */
  initialTab?: TabId;
  /** 로그인 후 자동 결제할 항목 (앱에서 넘김) */
  autoPurchase?: PendingNyangPurchase | null;
  onAutoPurchaseConsumed?: () => void;
  /** 저장 토스트와 동일한 하단 안내 */
  onAppToast?: (message: string) => void;
}

function formatPurchaseDate(ms: number, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleDateString();
  }
}

function NyangTicketSheet({
  onClose,
  initialTab = 'subscribe',
  autoPurchase = null,
  onAutoPurchaseConsumed,
  onAppToast,
}: NyangTicketSheetProps) {
  const { t, i18n } = useTranslation();
  const { signInWithGoogleIdToken } = useAuthSession();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [accessTick, setAccessTick] = useState(0);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PurchaseRecordDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

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

  const loadHistory = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !isGoogleSignedIn()) {
      setHistory([]);
      setHistoryError(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await fetchPurchaseRecords(token);
      setHistory(data.items ?? []);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : t('nyangTicket.historyLoadFailed'),
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab === 'history') void loadHistory();
  }, [tab, loadHistory]);

  void accessTick;
  const access = getDiaryAccessState();
  const packLeft = getAiPackCredits();
  const isPro = access.isPremiumActive;
  const subLeft = Math.max(0, access.monthlyRemaining);

  const recordSubscriptionPurchase = async (productId?: string | null) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await recordPurchaseRemote(token, {
        kind: 'subscription',
        productId: (productId && productId.trim()) || SUB_PRODUCT_ID,
        creditsGranted: 0,
      });
      void loadHistory();
    } catch (err) {
      console.warn('[nyangTicket] subscription history save failed', err);
    }
  };

  /** 비회원 → Google 회원 만든 뒤 true. 웹은 계정 시트로 보냄 */
  const ensureGoogleMember = async (
    pending: PendingNyangPurchase,
  ): Promise<boolean> => {
    if (isGoogleSignedIn()) return true;

    if (!isFlutterApp()) {
      setPendingNyangPurchase(pending);
      setError(t('nyangTicket.googleRequired'));
      window.dispatchEvent(new Event(REQUIRE_GOOGLE_FOR_PRO_EVENT));
      onClose();
      return false;
    }

    setBusy('google');
    setMessage(null);
    setError(null);
    clearPendingNyangPurchase();
    try {
      const idToken = await requestNativeGoogleSignIn();
      await signInWithGoogleIdToken(idToken);
      if (!isGoogleSignedIn()) {
        setError(t('nyangTicket.googleLoginFailed'));
        return false;
      }
      return true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : '';
      if (reason !== 'cancelled') {
        setError(t('nyangTicket.googleLoginFailed'));
      }
      return false;
    } finally {
      setBusy(null);
    }
  };

  const runSubscribe = async () => {
    if (!isFlutterApp()) {
      setError(t('subscription.appOnly'));
      return;
    }
    setBusy('sub');
    try {
      const ok = await requestSubscriptionPurchaseAndSync();
      if (ok) {
        setMessage(t('nyangTicket.subscribeDone'));
        await recordSubscriptionPurchase(SUB_PRODUCT_ID);
      }
    } finally {
      setBusy(null);
    }
  };

  const runBuyPack = async (productId: AiPackProductId) => {
    if (!isFlutterApp()) {
      setError(t('nyangTicket.appOnly'));
      return;
    }
    setBusy(productId);
    try {
      const result = await purchaseAiPack(productId);
      if (result.cancelled) return;
      if (result.ok) {
        const n = result.creditsGranted ?? aiPackCreditsLabel(productId);
        onAppToast?.(t('nyangTicket.packDone', { n }));
        void loadHistory();
        return;
      }
      if (result.error === 'need_google') {
        setError(t('nyangTicket.googleRequired'));
        return;
      }
      if (result.error === 'app_only') {
        setError(t('nyangTicket.appOnly'));
        return;
      }
      if (result.error === 'no_product' || result.error === 'invalid_product') {
        setError(t('nyangTicket.noProduct'));
        return;
      }
      if (result.error === 'not_configured') {
        setError(t('nyangTicket.notConfigured'));
        return;
      }
      if (result.error === 'timeout') {
        setError(t('nyangTicket.buyTimeout'));
        return;
      }
      setError(t('nyangTicket.buyFailed'));
      console.warn('[nyangTicket] pack purchase failed', result);
    } finally {
      setBusy(null);
    }
  };

  const handleSubscribe = async () => {
    if (busy) return;
    setMessage(null);
    setError(null);
    const pending: PendingNyangPurchase = { kind: 'subscribe' };
    if (!(await ensureGoogleMember(pending))) return;
    await runSubscribe();
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
    const pending: PendingNyangPurchase = { kind: 'pack', productId };
    if (!(await ensureGoogleMember(pending))) return;
    await runBuyPack(productId);
  };

  // 계정 시트에서 Google 로그인 후 재오픈 시 이어서 결제
  const autoPurchaseRan = useRef(false);
  useEffect(() => {
    if (!autoPurchase || autoPurchaseRan.current) return;
    if (!isGoogleSignedIn()) return;
    autoPurchaseRan.current = true;
    onAutoPurchaseConsumed?.();
    let cancelled = false;
    void (async () => {
      if (autoPurchase.kind === 'subscribe') {
        setTab('subscribe');
        if (cancelled) return;
        await runSubscribe();
        return;
      }
      setTab('packs');
      if (cancelled) return;
      await runBuyPack(autoPurchase.productId);
    })();
    return () => {
      cancelled = true;
    };
    // 마운트 시 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const purchaseTitle = (row: PurchaseRecordDto) => {
    if (row.kind === 'subscription') {
      return t('nyangTicket.historyItemSubscription');
    }
    if (row.creditsGranted > 0) {
      return t('nyangTicket.historyItemPack', { n: row.creditsGranted });
    }
    return row.productId;
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

        <div className="nyang-ticket__tabs nyang-ticket__tabs--3" role="tablist" aria-label={t('nyangTicket.tabsAria')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'subscribe'}
            className={tab === 'subscribe' ? 'is-active' : ''}
            onClick={() => setTab('subscribe')}
          >
            {t('nyangTicket.subscribeTitle')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'packs'}
            className={tab === 'packs' ? 'is-active' : ''}
            onClick={() => setTab('packs')}
          >
            {t('nyangTicket.packsTitle')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            className={tab === 'history' ? 'is-active' : ''}
            onClick={() => setTab('history')}
          >
            {t('nyangTicket.historyTitle')}
          </button>
        </div>

        {tab === 'subscribe' && (
          <section className="account-sheet__block nyang-ticket__panel" role="tabpanel">
            {isPro ? (
              <div className="nyang-ticket__sub-status" aria-live="polite">
                <span className="nyang-ticket__sub-status-title">
                  {t('nyangTicket.subscribed')}
                </span>
                <span className="nyang-ticket__sub-status-left">
                  {t('nyangTicket.packsRemaining', { n: subLeft })}
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="account-sheet__btn account-sheet__btn--solid nyang-ticket__btn"
                disabled={busy != null}
                onClick={() => void handleSubscribe()}
              >
                {busy === 'google'
                  ? t('nyangTicket.signingIn')
                  : busy === 'sub'
                    ? t('common.processing')
                    : t('nyangTicket.subscribeCta')}
              </button>
            )}
          </section>
        )}

        {tab === 'packs' && (
          <section className="account-sheet__block nyang-ticket__panel" role="tabpanel">
            <div className="nyang-ticket__sub-status" aria-live="polite">
              <span className="nyang-ticket__sub-status-title">
                {t('nyangTicket.packsRemaining', { n: packLeft })}
              </span>
            </div>
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
                      {busy === 'google'
                        ? t('nyangTicket.signingIn')
                        : busy === pack.id
                          ? t('common.processing')
                          : t('nyangTicket.buy')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'history' && (
          <section className="account-sheet__block nyang-ticket__panel" role="tabpanel">
            {!isGoogleSignedIn() ? (
              <p className="nyang-ticket__hint">{t('nyangTicket.historyNeedLogin')}</p>
            ) : historyLoading ? (
              <p className="nyang-ticket__hint">{t('common.loading')}</p>
            ) : historyError ? (
              <p className="nyang-ticket__err" role="alert">
                {historyError}
              </p>
            ) : history.length === 0 ? (
              <p className="nyang-ticket__hint">{t('nyangTicket.historyEmpty')}</p>
            ) : (
              <ul className="nyang-ticket__history">
                {history.map((row) => (
                  <li key={row.id} className="nyang-ticket__history-row">
                    <div className="nyang-ticket__history-main">
                      <span className="nyang-ticket__history-title">
                        {purchaseTitle(row)}
                      </span>
                      <span className="nyang-ticket__history-date">
                        {formatPurchaseDate(row.createdAt, i18n.language)}
                      </span>
                    </div>
                    <span className="nyang-ticket__history-status">
                      {t('nyangTicket.historyDone')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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

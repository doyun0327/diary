import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { APP_VERSION } from '../constants/app';
import { ALL_FLATICON_CREDITS } from '../utils/flaticonCredits';
import { isFlutterApp } from '../utils/nativeShare';
import { privacyPolicyArticleHtml, privacyPolicyLang } from '../utils/privacyPolicyHtml';
import { getInviteWebOrigin } from '../utils/roomInvite';
import { TIP_PRODUCTS, type TipProductId } from '../utils/tipProducts';
import { fetchTipStorePrices, waitForTipPurchase } from '../utils/tipPurchase';
import CloseIcon from './CloseIcon';
import './AppInfoSheet.css';

const ACCOUNT_DELETION_PATH = '/account-deletion.html';

function accountDeletionUrl(): string {
  return `${getInviteWebOrigin()}${ACCOUNT_DELETION_PATH}`;
}

/** privacy.html 의 ./account-deletion.html 등 상대 링크를 공개 URL로 */
function resolveLegalHref(href: string): string {
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('./')) return `${getInviteWebOrigin()}/${raw.slice(2)}`;
  if (raw.startsWith('/')) return `${getInviteWebOrigin()}${raw}`;
  return `${getInviteWebOrigin()}/${raw}`;
}

interface AppInfoSheetProps {
  onClose: () => void;
  /** 처음 보여줄 화면 (구독 화면의 약관 링크는 'legal') */
  initialView?: 'main' | 'legal';
}

type View = 'main' | 'legal' | 'privacy' | 'licenses' | 'churu';

function AppInfoSheet({ onClose, initialView = 'main' }: AppInfoSheetProps) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>(initialView);
  const [buyingId, setBuyingId] = useState<TipProductId | null>(null);
  const [tipMessage, setTipMessage] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [storePrices, setStorePrices] = useState<Record<string, string>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /** 구독 화면 약관 링크로 열렸으면 뒤로 = 닫기 (구독 화면으로 복귀) */
  const openedForLegal = initialView === 'legal';
  const goBack = () => {
    if (view === 'privacy') {
      setView('legal');
      return;
    }
    if (openedForLegal) onClose();
    else setView('main');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view === 'privacy') setView('legal');
      else if (view !== 'main' && !openedForLegal) setView('main');
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, openedForLegal, view]);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => {
    if (view !== 'churu') {
      setBuyingId(null);
      setTipMessage(null);
      setTipError(null);
      return;
    }

    let cancelled = false;
    setPricesLoading(true);
    void fetchTipStorePrices()
      .then((prices) => {
        if (!cancelled) setStorePrices(prices);
      })
      .finally(() => {
        if (!cancelled) setPricesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view]);

  const title =
    view === 'privacy'
      ? t('appInfo.legal.privacyHeading')
      : view === 'legal'
      ? t('appInfo.legal.title')
      : view === 'licenses'
        ? t('appInfo.licenses.title')
        : view === 'churu'
          ? t('appInfo.churu.title')
          : t('appInfo.title');

  const handleBuy = async (productId: TipProductId) => {
    if (buyingId) return;
    setTipMessage(null);
    setTipError(null);

    if (!isFlutterApp()) {
      setTipError(t('appInfo.churu.appOnly'));
      return;
    }

    setBuyingId(productId);
    try {
      const result = await waitForTipPurchase(productId);
      if (result.cancelled) return;
      if (result.ok) {
        setTipMessage(t('appInfo.churu.thanks'));
        return;
      }
      if (result.error === 'app_only') {
        setTipError(t('appInfo.churu.appOnly'));
        return;
      }
      if (result.error === 'no_product') {
        setTipError(t('appInfo.churu.noProduct'));
        return;
      }
      setTipError(t('appInfo.churu.failed'));
    } finally {
      setBuyingId(null);
    }
  };

  const priceFor = (productId: TipProductId, fallback: string) => {
    if (buyingId === productId) return t('appInfo.churu.buying');
    const store = storePrices[productId];
    if (store) return store;
    if (pricesLoading && isFlutterApp()) return '…';
    return fallback;
  };

  return (
    <div
      className={`app-info${openedForLegal ? ' app-info--above-sheets' : ''}`}
      role="dialog"
      aria-label={t('appInfo.aria')}
    >
      <div className="app-info__backdrop" onClick={onClose} />
      <div className="app-info__panel" ref={panelRef}>
        <header className="app-info__head">
          {view !== 'main' ? (
            <button type="button" className="app-info__back" onClick={goBack}>
              {t('appInfo.back')}
            </button>
          ) : (
            <span className="app-info__back-spacer" />
          )}
          <h2>{title}</h2>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>

        {view === 'main' && (
          <ul className="app-info__list">
            <li className="app-info__row app-info__row--static">
              <span className="app-info__row-label">{t('appInfo.version')}</span>
              <span className="app-info__row-value">v{APP_VERSION}</span>
            </li>
            <li>
              <button type="button" className="app-info__row" onClick={() => setView('churu')}>
                <span className="app-info__row-label">{t('appInfo.churu.menu')}</span>
                <span className="app-info__chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
            <li>
              <button type="button" className="app-info__row" onClick={() => setView('legal')}>
                <span className="app-info__row-label">{t('appInfo.legal.menu')}</span>
                <span className="app-info__chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
            <li>
              <button type="button" className="app-info__row" onClick={() => setView('licenses')}>
                <span className="app-info__row-label">{t('appInfo.licenses.menu')}</span>
                <span className="app-info__chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          </ul>
        )}

        {view === 'churu' && (
          <div className="app-info__churu">
            <div className="app-info__churu-hero" aria-hidden>
              🐟
            </div>
            <p className="app-info__churu-lead">{t('appInfo.churu.lead')}</p>
            <ul className="app-info__churu-list">
              {TIP_PRODUCTS.map((product) => {
                const disabled = buyingId != null;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="app-info__churu-btn"
                      disabled={disabled}
                      onClick={() => void handleBuy(product.id)}
                    >
                      <span className="app-info__churu-btn-emoji" aria-hidden>
                        {product.emoji}
                      </span>
                      <span className="app-info__churu-btn-text">
                        <span className="app-info__churu-btn-name">
                          {t(`appInfo.churu.products.${product.nameKey}`)}
                        </span>
                        <span className="app-info__churu-btn-price">
                          {priceFor(product.id, product.fallbackPriceLabel)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {tipMessage && (
              <p className="app-info__churu-thanks" role="status">
                {tipMessage}
              </p>
            )}
            {tipError && (
              <p className="app-info__churu-error" role="alert">
                {tipError}
              </p>
            )}
          </div>
        )}

        {view === 'legal' && (
          <div className="app-info__doc">
            <h3>{t('appInfo.legal.termsHeading')}</h3>
            <p>{t('appInfo.legal.termsBody')}</p>
            <h3>{t('appInfo.legal.privacyHeading')}</h3>
            <p>
              <Trans
                i18nKey="appInfo.legal.privacyBody"
                components={{
                  privacyLink: (
                    <button
                      type="button"
                      className="app-info__text-link"
                      onClick={() => setView('privacy')}
                    />
                  ),
                }}
              />
            </p>
            <h3>{t('appInfo.legal.accountDeletionHeading')}</h3>
            <p>
              <Trans
                i18nKey="appInfo.legal.accountDeletionBody"
                components={{
                  deletionLink: (
                    <a
                      className="app-info__text-link"
                      href={accountDeletionUrl()}
                      target="_blank"
                      rel="noreferrer"
                    />
                  ),
                }}
              />
            </p>
            <h3>{t('appInfo.legal.refundHeading')}</h3>
            <p>{t('appInfo.legal.refundBody')}</p>
          </div>
        )}

        {view === 'privacy' && (
          <div
            className="app-info__privacy"
            lang={privacyPolicyLang(i18n.resolvedLanguage || i18n.language)}
            onClick={(e) => {
              const anchor = (e.target as HTMLElement).closest('a');
              if (!anchor) return;
              const href = anchor.getAttribute('href') ?? '';
              if (href.startsWith('http://') || href.startsWith('https://')) return;
              e.preventDefault();
              const resolved = resolveLegalHref(href);
              if (resolved.startsWith('http')) {
                window.open(resolved, '_blank', 'noopener,noreferrer');
              }
            }}
            dangerouslySetInnerHTML={{
              __html: privacyPolicyArticleHtml(i18n.resolvedLanguage || i18n.language || 'ko'),
            }}
          />
        )}

        {view === 'licenses' && (
          <div className="app-info__doc">
            <h3>{t('appInfo.licenses.iconsHeading')}</h3>
            <ul className="app-info__libs">
              {ALL_FLATICON_CREDITS.map((credit) => (
                <li key={credit.id}>
                  <a href={credit.href} target="_blank" rel="noreferrer">
                    {t('credits.flaticonLine', {
                      usage: t(`appInfo.licenses.usage.${credit.usageKey}`),
                      author: credit.author,
                    })}
                  </a>
                </li>
              ))}
            </ul>
            <p className="app-info__note">{t('appInfo.licenses.note')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppInfoSheet;

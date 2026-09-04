import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../constants/app';
import { MOOD_ICON_CREDITS } from '../utils/moodPack';
import { isFlutterApp } from '../utils/nativeShare';
import { TIP_PRODUCTS, type TipProductId } from '../utils/tipProducts';
import { fetchTipStorePrices, waitForTipPurchase } from '../utils/tipPurchase';
import CloseIcon from './CloseIcon';
import './AppInfoSheet.css';

interface AppInfoSheetProps {
  onClose: () => void;
}

type View = 'main' | 'legal' | 'licenses' | 'churu';

function AppInfoSheet({ onClose }: AppInfoSheetProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('main');
  const [buyingId, setBuyingId] = useState<TipProductId | null>(null);
  const [tipMessage, setTipMessage] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [storePrices, setStorePrices] = useState<Record<string, string>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view !== 'main') setView('main');
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, view]);

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
    view === 'legal'
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
    <div className="app-info" role="dialog" aria-label={t('appInfo.aria')}>
      <div className="app-info__backdrop" onClick={onClose} />
      <div className="app-info__panel">
        <header className="app-info__head">
          {view !== 'main' ? (
            <button type="button" className="app-info__back" onClick={() => setView('main')}>
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
            <p>{t('appInfo.legal.privacyBody')}</p>
          </div>
        )}

        {view === 'licenses' && (
          <div className="app-info__doc">
            <h3>{t('appInfo.licenses.iconsHeading')}</h3>
            <ul className="app-info__libs">
              {MOOD_ICON_CREDITS.map((credit) => (
                <li key={credit.packId}>
                  <a href={credit.href} target="_blank" rel="noreferrer">
                    {t('credits.moodIcons', { author: credit.author })}
                  </a>
                  {` (${t(`emojiPack.${credit.packId}.name`)})`}
                </li>
              ))}
            </ul>
            <h3>{t('appInfo.licenses.libsHeading')}</h3>
            <ul className="app-info__libs">
              <li>React — MIT</li>
              <li>Vite — MIT</li>
              <li>i18next / react-i18next — MIT</li>
              <li>jsPDF — MIT</li>
              <li>modern-screenshot — MIT</li>
              <li>react-router-dom — MIT</li>
            </ul>
            <p className="app-info__note">{t('appInfo.licenses.note')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppInfoSheet;

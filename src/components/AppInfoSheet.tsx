import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../constants/app';
import { MOOD_ICON_CREDITS } from '../utils/moodPack';
import CloseIcon from './CloseIcon';
import './AppInfoSheet.css';

interface AppInfoSheetProps {
  onClose: () => void;
}

type View = 'main' | 'legal' | 'licenses';

function AppInfoSheet({ onClose }: AppInfoSheetProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('main');


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view !== 'main') setView('main');
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, view]);

  const title =
    view === 'legal'
      ? t('appInfo.legal.title')
      : view === 'licenses'
        ? t('appInfo.licenses.title')
        : t('appInfo.title');

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

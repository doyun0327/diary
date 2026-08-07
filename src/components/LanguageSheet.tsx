import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_LANGUAGES, setStoredLanguage } from '../i18n';
import './AccountSheet.css';

interface LanguageSheetProps {
  onClose: () => void;
}

function LanguageSheet({ onClose }: LanguageSheetProps) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="account-sheet" role="dialog" aria-label={t('language.aria')}>
      <div className="account-sheet__backdrop" onClick={onClose} />
      <div className="account-sheet__panel">
        <header className="account-sheet__head">
          <h2>{t('language.title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            {t('common.close')}
          </button>
        </header>

        <section className="account-sheet__block">
          <p className="account-sheet__hint">{t('language.hint')}</p>
          <div className="account-sheet__lang-row">
            {APP_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`account-sheet__lang-btn ${i18n.language?.startsWith(lang) ? 'is-active' : ''}`}
                onClick={() => {
                  void i18n.changeLanguage(lang);
                  setStoredLanguage(lang);
                }}
              >
                {t(`language.${lang}`)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default LanguageSheet;

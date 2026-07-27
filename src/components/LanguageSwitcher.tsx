import { useTranslation } from 'react-i18next';
import { setStoredLanguage, type AppLanguage } from '../i18n';
import './LanguageSwitcher.css';

interface LanguageSwitcherProps {
  /** header = 상단 콤팩트, menu = 메뉴 안 블록 */
  variant?: 'header' | 'menu';
}

function LanguageSwitcher({ variant = 'header' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const current = (i18n.language?.startsWith('en') ? 'en' : 'ko') as AppLanguage;

  const select = (lang: AppLanguage) => {
    if (lang === current) return;
    void i18n.changeLanguage(lang);
    setStoredLanguage(lang);
  };

  if (variant === 'menu') {
    return (
      <section className="lang-switch lang-switch--menu" aria-label={t('language.label')}>
        <p className="lang-switch__section">{t('language.label')}</p>
        <p className="lang-switch__hint">{t('language.hint')}</p>
        <div className="lang-switch__row" role="group">
          <button
            type="button"
            className={current === 'ko' ? 'is-active' : ''}
            onClick={() => select('ko')}
          >
            {t('language.ko')}
          </button>
          <button
            type="button"
            className={current === 'en' ? 'is-active' : ''}
            onClick={() => select('en')}
          >
            {t('language.en')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="lang-switch lang-switch--header" role="group" aria-label={t('language.label')}>
      <button
        type="button"
        className={current === 'ko' ? 'is-active' : ''}
        onClick={() => select('ko')}
        aria-pressed={current === 'ko'}
      >
        KO
      </button>
      <span aria-hidden>/</span>
      <button
        type="button"
        className={current === 'en' ? 'is-active' : ''}
        onClick={() => select('en')}
        aria-pressed={current === 'en'}
      >
        EN
      </button>
    </div>
  );
}

export default LanguageSwitcher;

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  THEMES,
  applyTheme,
  getStoredThemeId,
  type ThemeId,
} from '../utils/theme';
import {
  MOOD_PACKS,
  applyMoodPack,
  getStoredMoodPackId,
  type MoodPackId,
} from '../utils/moodPack';
import MoodIcon from './MoodIcon';
import CloseIcon from './CloseIcon';
import './DecorateSheet.css';

interface DecorateSheetProps {
  onClose: () => void;
}

type Tab = 'theme' | 'emoji';

function DecorateSheet({ onClose }: DecorateSheetProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('theme');
  const [themeId, setThemeId] = useState<ThemeId>(() => getStoredThemeId());
  const [packId, setPackId] = useState<MoodPackId>(() => getStoredMoodPackId());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickTheme = (id: ThemeId) => {
    setThemeId(id);
    applyTheme(id);
  };

  const pickPack = (id: MoodPackId) => {
    setPackId(id);
    applyMoodPack(id);
  };

  return (
    <div className="decorate-sheet" role="dialog" aria-label={t('decorate.aria')}>
      <div className="decorate-sheet__backdrop" onClick={onClose} />
      <div className="decorate-sheet__panel">
        <header className="decorate-sheet__head">
          <h2>{t('decorate.title')}</h2>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="decorate-sheet__tabs" role="tablist" aria-label={t('decorate.tabsAria')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'theme'}
            className={tab === 'theme' ? 'is-active' : ''}
            onClick={() => setTab('theme')}
          >
            {t('decorate.tab.theme')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'emoji'}
            className={tab === 'emoji' ? 'is-active' : ''}
            onClick={() => setTab('emoji')}
          >
            {t('decorate.tab.emoji')}
          </button>
        </div>

        {tab === 'theme' && (
          <>
            <p className="decorate-sheet__hint">{t('theme.hint')}</p>
            <ul className="decorate-sheet__list">
              {THEMES.map((theme) => {
                const active = themeId === theme.id;
                return (
                  <li key={theme.id}>
                    <button
                      type="button"
                      className={`decorate-sheet__option${active ? ' is-active' : ''}`}
                      onClick={() => pickTheme(theme.id)}
                      aria-pressed={active}
                    >
                      <span className="decorate-sheet__swatch" aria-hidden>
                        {theme.swatch.map((color) => (
                          <span key={color} style={{ background: color }} />
                        ))}
                      </span>
                      <span className="decorate-sheet__text">
                        <strong>{t(`theme.${theme.id}.name`)}</strong>
                        <span>{t(`theme.${theme.id}.desc`)}</span>
                      </span>
                      <span className="decorate-sheet__check" aria-hidden>
                        {active ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === 'emoji' && (
          <>
            <p className="decorate-sheet__hint">{t('emojiPack.hint')}</p>
            <ul className="decorate-sheet__list">
              {MOOD_PACKS.map((pack) => {
                const active = packId === pack.id;
                return (
                  <li key={pack.id}>
                    <button
                      type="button"
                      className={`decorate-sheet__option${active ? ' is-active' : ''}`}
                      onClick={() => pickPack(pack.id)}
                      aria-pressed={active}
                    >
                      <span className="decorate-sheet__mood-preview" aria-hidden>
                        {pack.preview.map((mood) => (
                          <MoodIcon key={mood} mood={mood} packId={pack.id} size={22} />
                        ))}
                      </span>
                      <span className="decorate-sheet__text">
                        <strong>{t(`emojiPack.${pack.id}.name`)}</strong>
                        <span>{t(`emojiPack.${pack.id}.desc`)}</span>
                      </span>
                      <span className="decorate-sheet__check" aria-hidden>
                        {active ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export default DecorateSheet;

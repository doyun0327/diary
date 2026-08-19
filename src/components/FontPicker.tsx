import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveAppLanguage } from '../i18n';
import {
  FONT_SIZE_IDS,
  applyDiaryFontSize,
  applyLanguageFonts,
  diaryFontStack,
  findFont,
  fontsForLanguage,
  getPreferredFontId,
  getPreferredFontSizeId,
  parseFontSizeId,
  setPreferredFontId,
  setPreferredFontSizeId,
  type FontSizeId,
} from '../utils/fonts';
import CloseIcon from './CloseIcon';
import './FontPicker.css';

const CATEGORIES = ['cute', 'neat'] as const;

/** 앱 시작 시 — 새 일기용 기본 글씨체만 루트에 적용 */
export function applyStoredFont() {
  applyLanguageFonts();
}

interface FontSizePickerProps {
  value: FontSizeId;
  onChange: (id: FontSizeId) => void;
}

export function FontSizePicker({ value, onChange }: FontSizePickerProps) {
  const { t } = useTranslation();
  return (
    <div className="font-size-picker" role="group" aria-label={t('font.sizeAria')}>
      <p className="font-size-picker__label">{t('font.size')}</p>
      <div className="font-size-picker__row">
        {FONT_SIZE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`font-size-picker__btn font-size-picker__btn--${id} ${value === id ? 'selected' : ''}`}
            onClick={() => onChange(id)}
          >
            {t(`font.sizes.${id}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface FontPickerProps {
  onClose: () => void;
}

/** 헤더 글씨체 = 앞으로 쓸 새 일기의 기본값 (이미 저장한 일기에는 영향 없음) */
function FontPicker({ onClose }: FontPickerProps) {
  const { t, i18n } = useTranslation();
  const langFonts = fontsForLanguage(resolveAppLanguage(i18n.language));
  const [fontId, setFontId] = useState(() => getPreferredFontId());
  const [fontSizeId, setFontSizeId] = useState(() => getPreferredFontSizeId());

  useEffect(() => {
    setFontId(getPreferredFontId());
  }, [i18n.language]);

  useEffect(() => {
    const font = findFont(fontId);
    document.documentElement.style.setProperty('--diary-font', diaryFontStack(font.family));
    setPreferredFontId(fontId);
  }, [fontId]);

  useEffect(() => {
    applyDiaryFontSize(fontSizeId);
    setPreferredFontSizeId(fontSizeId);
  }, [fontSizeId]);

  const selectFont = (id: string) => {
    setFontId(id);
    onClose();
  };

  return (
    <div className="font-picker" role="dialog" aria-label={t('font.dialogAria')}>
      <div className="font-picker__backdrop" onClick={onClose} />
      <div className="font-picker__sheet">
        <header className="font-picker__head">
          <h2>{t('font.title')}</h2>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>
        <FontSizePicker value={parseFontSizeId(fontSizeId)} onChange={setFontSizeId} />
        <div className="font-picker__list">
          {CATEGORIES.map((category) => {
            const items = langFonts.filter((f) => f.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <p className="font-picker__category">{t(`font.cat.${category}`)}</p>
                {items.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`font-picker__item ${fontId === f.id ? 'selected' : ''}`}
                    style={{ fontFamily: f.family }}
                    onClick={() => selectFont(f.id)}
                  >
                    <span>{f.label}</span>
                    <span className="font-picker__sample">{t('font.sample')}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FontPicker;

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FONTS,
  diaryFontStack,
  findFont,
  getPreferredFontId,
  setPreferredFontId,
} from '../utils/fonts';
import CloseIcon from './CloseIcon';
import './FontPicker.css';

const CATEGORIES = ['cute', 'neat'] as const;

/** 앱 시작 시 — 새 일기용 기본 글씨체만 루트에 적용 */
export function applyStoredFont() {
  const font = findFont(getPreferredFontId());
  document.documentElement.style.setProperty('--diary-font', diaryFontStack(font.family));
}

interface FontPickerProps {
  onClose: () => void;
}

/** 헤더 글씨체 = 앞으로 쓸 새 일기의 기본값 (이미 저장한 일기에는 영향 없음) */
function FontPicker({ onClose }: FontPickerProps) {
  const { t } = useTranslation();
  const [fontId, setFontId] = useState(() => getPreferredFontId());

  useEffect(() => {
    const font = findFont(fontId);
    document.documentElement.style.setProperty('--diary-font', diaryFontStack(font.family));
    setPreferredFontId(fontId);
  }, [fontId]);

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
        <div className="font-picker__list">
          {CATEGORIES.map((category) => (
            <div key={category}>
              <p className="font-picker__category">{t(`font.cat.${category}`)}</p>
              {FONTS.filter((f) => f.category === category).map((f) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}

export default FontPicker;

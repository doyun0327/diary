import { useEffect, useState } from 'react';
import { DEFAULT_FONT_ID, FONTS, FONT_CATEGORY_LABELS, findFont } from '../utils/fonts';
import './FontPicker.css';

const STORAGE_KEY = 'picture-diary-font';

const CATEGORIES = ['cute', 'neat'] as const;

/** 앱 시작 시 저장된 글씨체 적용 */
export function applyStoredFont() {
  const id = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_FONT_ID;
  const font = findFont(id);
  document.documentElement.style.setProperty('--diary-font', font.family);
}

interface FontPickerProps {
  onClose: () => void;
}

function FontPicker({ onClose }: FontPickerProps) {
  const [fontId, setFontId] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_FONT_ID,
  );

  useEffect(() => {
    const font = findFont(fontId);
    document.documentElement.style.setProperty('--diary-font', font.family);
    localStorage.setItem(STORAGE_KEY, fontId);
  }, [fontId]);

  const selectFont = (id: string) => {
    setFontId(id);
    onClose();
  };

  return (
    <div className="font-picker" role="dialog" aria-label="글씨체 선택">
      <div className="font-picker__backdrop" onClick={onClose} />
      <div className="font-picker__sheet">
        <header className="font-picker__head">
          <h2>글씨체</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="font-picker__list">
          {CATEGORIES.map((category) => (
            <div key={category}>
              <p className="font-picker__category">{FONT_CATEGORY_LABELS[category]}</p>
              {FONTS.filter((f) => f.category === category).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`font-picker__item ${fontId === f.id ? 'selected' : ''}`}
                  style={{ fontFamily: f.family }}
                  onClick={() => selectFont(f.id)}
                >
                  <span>{f.label}</span>
                  <span className="font-picker__sample">오늘의 diary</span>
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

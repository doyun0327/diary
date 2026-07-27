import { useEffect, useState } from 'react';
import {
  FONTS,
  FONT_CATEGORY_LABELS,
  findFont,
  getPreferredFontId,
  setPreferredFontId,
} from '../utils/fonts';
import './FontPicker.css';

const CATEGORIES = ['cute', 'neat'] as const;

/** 앱 시작 시 — 새 일기용 기본 글씨체만 루트에 적용 */
export function applyStoredFont() {
  const font = findFont(getPreferredFontId());
  document.documentElement.style.setProperty('--diary-font', font.family);
}

interface FontPickerProps {
  onClose: () => void;
}

/** 헤더 글씨체 = 앞으로 쓸 새 일기의 기본값 (이미 저장한 일기에는 영향 없음) */
function FontPicker({ onClose }: FontPickerProps) {
  const [fontId, setFontId] = useState(() => getPreferredFontId());

  useEffect(() => {
    const font = findFont(fontId);
    document.documentElement.style.setProperty('--diary-font', font.family);
    setPreferredFontId(fontId);
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

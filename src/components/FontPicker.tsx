import { useEffect, useState } from 'react';
import { DEFAULT_FONT_ID, FONTS, FONT_CATEGORY_LABELS, findFont } from '../utils/fonts';
import './FontPicker.css';

const STORAGE_KEY = 'picture-diary-font';

const CATEGORIES = ['cute', 'neat'] as const;

function FontPicker() {
  const [fontId, setFontId] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_FONT_ID,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const font = findFont(fontId);
    document.documentElement.style.setProperty('--diary-font', font.family);
    localStorage.setItem(STORAGE_KEY, fontId);
  }, [fontId]);

  const selectFont = (id: string) => {
    setFontId(id);
    setOpen(false);
  };

  return (
    <div className="font-picker">
      <button
        type="button"
        className="font-picker__toggle"
        aria-label="글씨체 선택"
        onClick={() => setOpen((v) => !v)}
      >
        가나
      </button>

      {open && (
        <>
          <div className="font-picker__backdrop" onClick={() => setOpen(false)} />
          <div className="font-picker__popup" role="dialog" aria-label="글씨체 선택">
            {CATEGORIES.map((category) => (
              <div key={category}>
                <p className="font-picker__category">
                  {FONT_CATEGORY_LABELS[category]}
                </p>
                {FONTS.filter((f) => f.category === category).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`font-picker__item ${fontId === f.id ? 'selected' : ''}`}
                    style={{ fontFamily: f.family }}
                    onClick={() => selectFont(f.id)}
                  >
                    <span>{f.label}</span>
                    <span className="font-picker__sample">오늘의 그림일기</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default FontPicker;

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './MonthYearPicker.css';

interface MonthYearPickerProps {
  year: number;
  /** 0–11 */
  month: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}

const MIN_YEAR = 2026;
const ITEM_H = 44;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

function clampYear(y: number) {
  return Math.max(MIN_YEAR, y);
}

function maxYear() {
  const y = new Date().getFullYear();
  return Math.max(y + 40, MIN_YEAR + 40);
}

function WheelColumn({
  items,
  value,
  ariaLabel,
  format,
  onChange,
}: {
  items: number[];
  value: number;
  ariaLabel: string;
  format: (item: number) => string;
  onChange: (item: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  const dragging = useRef(false);

  const indexOf = (v: number) => {
    const i = items.indexOf(v);
    return i >= 0 ? i : 0;
  };

  const scrollToIndex = (index: number, behavior: ScrollBehavior = 'auto') => {
    const el = scrollerRef.current;
    if (!el) return;
    const top = Math.max(0, Math.min(items.length - 1, index)) * ITEM_H;
    el.scrollTo({ top, behavior });
  };

  useLayoutEffect(() => {
    scrollToIndex(indexOf(value), 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초기/외부 값 동기화
  }, [value]);

  const commitFromScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const index = Math.max(
      0,
      Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)),
    );
    scrollToIndex(index, 'smooth');
    const next = items[index];
    if (next !== undefined && next !== value) onChange(next);
  };

  const onScroll = () => {
    if (dragging.current) return;
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(commitFromScroll, 120);
  };

  return (
    <div className="month-year-picker__wheel" aria-label={ariaLabel}>
      <div className="month-year-picker__viewport">
        <div
          ref={scrollerRef}
          className="month-year-picker__scroller"
          onScroll={onScroll}
          onTouchStart={() => {
            dragging.current = true;
            if (settleTimer.current) window.clearTimeout(settleTimer.current);
          }}
          onTouchEnd={() => {
            dragging.current = false;
            commitFromScroll();
          }}
          onMouseDown={() => {
            dragging.current = true;
          }}
          onMouseUp={() => {
            dragging.current = false;
            commitFromScroll();
          }}
          onWheel={() => {
            dragging.current = true;
            if (settleTimer.current) window.clearTimeout(settleTimer.current);
            settleTimer.current = window.setTimeout(() => {
              dragging.current = false;
              commitFromScroll();
            }, 140);
          }}
        >
          <div className="month-year-picker__pad" style={{ height: PAD }} aria-hidden />
          {items.map((item) => {
            const selected = item === value;
            return (
              <div
                key={item}
                role="option"
                aria-selected={selected}
                className={`month-year-picker__item${selected ? ' is-selected' : ''}`}
                style={{ height: ITEM_H }}
                onClick={() => {
                  onChange(item);
                  scrollToIndex(indexOf(item), 'smooth');
                }}
              >
                {format(item)}
              </div>
            );
          })}
          <div className="month-year-picker__pad" style={{ height: PAD }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

/** 헤더 연·월 — 스크롤 휠로 연·월 동시 선택 (2026~) */
function MonthYearPicker({ year, month, onSelect, onClose }: MonthYearPickerProps) {
  const { t } = useTranslation();
  const years = useMemo(
    () => Array.from({ length: maxYear() - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i),
    [],
  );
  const months = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], []);

  const [draftYear, setDraftYear] = useState(() => clampYear(year));
  const [draftMonth, setDraftMonth] = useState(() =>
    Math.max(0, Math.min(11, month)),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const now = new Date();
  const thisYear = Math.max(MIN_YEAR, now.getFullYear());
  const thisMonth = now.getMonth();

  return createPortal(
    <div className="month-year-picker-root">
      <button
        type="button"
        className="month-year-picker__backdrop"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div
        className="month-year-picker"
        role="dialog"
        aria-modal="true"
        aria-label={t('calendar.pickYearMonthAria')}
      >
        <header className="month-year-picker__head">
          <button type="button" className="month-year-picker__head-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="month-year-picker__head-btn month-year-picker__head-btn--primary"
            onClick={() => onSelect(draftYear, draftMonth)}
          >
            {t('calendar.done')}
          </button>
        </header>

        <div className="month-year-picker__wheels">
          <div className="month-year-picker__highlight" aria-hidden />
          <WheelColumn
            items={years}
            value={draftYear}
            ariaLabel={t('calendar.yearsAria')}
            format={(y) => `${y}${t('calendar.yearSuffix')}`}
            onChange={setDraftYear}
          />
          <WheelColumn
            items={months}
            value={draftMonth}
            ariaLabel={t('calendar.monthsAria')}
            format={(m) => t(`calendar.months.${m + 1}`)}
            onChange={setDraftMonth}
          />
        </div>

        <button
          type="button"
          className="month-year-picker__today"
          onClick={() => {
            setDraftYear(thisYear);
            setDraftMonth(thisMonth);
          }}
        >
          {t('calendar.thisMonth')}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default MonthYearPicker;

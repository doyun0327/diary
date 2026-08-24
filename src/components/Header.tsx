import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatYearMonth } from '../utils/date';
import MonthYearPicker from './MonthYearPicker';
import './Header.css';

interface HeaderProps {
  nickname?: string;
  avatarUrl?: string | null;
  onOpenAccount?: () => void;
  onOpenLanguage?: () => void;
  screenLockEnabled?: boolean;
  onToggleScreenLock?: () => void;
  onOpenDecorate?: () => void;
  onOpenExport?: () => void;
  onOpenRooms?: () => void;
  onOpenAppInfo?: () => void;
  onOpenSearch?: () => void;
  calendarNav?: {
    year: number;
    month: number;
    onPrev: () => void;
    onNext: () => void;
    onSelectMonth: (year: number, month: number) => void;
  } | null;
  /** Flutter AppBar ?????? ??? ??? ?????? ?? ????? ????? ????? */
  hideBar?: boolean;
  /** Flutter AppBar ???? */
  onNativeBack?: () => void;
  onNativeSave?: () => void;
}

function CrayonSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="header-menu__crayon"
    >
      {children}
    </svg>
  );
}

function IconUser() {
  return (
    <CrayonSvg>
      <ellipse cx="12.1" cy="11.2" rx="6.4" ry="6.6" fill="currentColor" fillOpacity="0.12" />
      <path
        d="M6.2 11.4c.3-3.6 2.6-6.4 5.9-6.6 3.5-.2 6.3 2.4 6.6 5.9.3 3.2-1.8 6.4-5.4 6.9-3.4.4-6.7-2-7.1-6.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="9.7" cy="10.6" r="0.85" fill="currentColor" />
      <circle cx="14.4" cy="10.4" r="0.85" fill="currentColor" />
      <ellipse cx="8.6" cy="12.6" rx="1.15" ry="0.7" fill="currentColor" fillOpacity="0.22" />
      <ellipse cx="15.5" cy="12.4" rx="1.15" ry="0.7" fill="currentColor" fillOpacity="0.22" />
      <path
        d="M9.6 14.4c.9 1.3 2.1 1.8 3.6 1.6 1.3-.2 2.3-.9 2.8-1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </CrayonSvg>
  );
}

function IconGlobe() {
  return (
    <CrayonSvg>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </CrayonSvg>
  );
}

function IconLock() {
  return (
    <CrayonSvg>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </CrayonSvg>
  );
}

function IconUsers() {
  return (
    <CrayonSvg>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </CrayonSvg>
  );
}

function IconPalette() {
  return (
    <CrayonSvg>
      <g transform="translate(1.2 1.2) scale(0.85)">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </CrayonSvg>
  );
}

function IconDownload() {
  return (
    <CrayonSvg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.6" />
      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.6" />
      <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </CrayonSvg>
  );
}

function IconInfo() {
  return (
    <CrayonSvg>
      <g transform="translate(1.2 1.2) scale(0.85)">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </CrayonSvg>
  );
}

function IconChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  tone = 'peach',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  tone?: 'peach' | 'mint' | 'lavender' | 'cream';
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`header-menu__item header-menu__item--${tone}`}
        onClick={onClick}
      >
        <span className="header-menu__icon">{icon}</span>
        <span className="header-menu__text">
          <span className="header-menu__label">{label}</span>
          {hint ? <span className="header-menu__hint">{hint}</span> : null}
        </span>
      </button>
    </li>
  );
}

function MenuToggleItem({
  icon,
  label,
  hint,
  checked,
  tone = 'lavender',
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  tone?: 'peach' | 'mint' | 'lavender' | 'cream';
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`header-menu__item header-menu__item--${tone} header-menu__item--toggle`}
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
      >
        <span className="header-menu__icon">{icon}</span>
        <span className="header-menu__text">
          <span className="header-menu__label">{label}</span>
          {hint ? <span className="header-menu__hint">{hint}</span> : null}
        </span>
        <span className={`header-menu__switch${checked ? ' is-on' : ''}`} aria-hidden>
          <span className="header-menu__switch-knob" />
        </span>
      </button>
    </li>
  );
}

function Header({
  nickname = '',
  avatarUrl = null,
  onOpenAccount,
  onOpenLanguage,
  screenLockEnabled = false,
  onToggleScreenLock,
  onOpenDecorate,
  onOpenExport,
  onOpenRooms,
  onOpenAppInfo,
  calendarNav = null,
  hideBar = false,
  onNativeBack,
  onNativeSave,
  onOpenSearch,
}: HeaderProps) {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const menuCloseTimerRef = useRef<number | null>(null);

  const clearMenuCloseTimer = useCallback(() => {
    if (menuCloseTimerRef.current != null) {
      window.clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearMenuCloseTimer();
    setMenuClosing(false);
    setMenuVisible(true);
  }, [clearMenuCloseTimer]);

  const closeMenu = useCallback(() => {
    if (!menuVisible || menuClosing) return;
    clearMenuCloseTimer();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMenuVisible(false);
      setMenuClosing(false);
      return;
    }

    setMenuClosing(true);
    menuCloseTimerRef.current = window.setTimeout(() => {
      setMenuVisible(false);
      setMenuClosing(false);
      menuCloseTimerRef.current = null;
    }, 360);
  }, [clearMenuCloseTimer, menuClosing, menuVisible]);

  const finishMenuClose = useCallback(() => {
    clearMenuCloseTimer();
    setMenuVisible(false);
    setMenuClosing(false);
  }, [clearMenuCloseTimer]);

  useEffect(() => {
    return () => clearMenuCloseTimer();
  }, [clearMenuCloseTimer]);

  useEffect(() => {
    if (!menuVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [closeMenu, menuVisible]);

  useEffect(() => {
    if (!calendarNav) setMonthPickerOpen(false);
  }, [calendarNav]);

  useEffect(() => {
    window.diaryHeaderAction = (action, payload) => {
      if (action === 'openMenu') {
        setMonthPickerOpen(false);
        if (menuVisible && !menuClosing) closeMenu();
        else openMenu();
      }
      if (action === 'openSearch') {
        closeMenu();
        setMonthPickerOpen(false);
        onOpenSearch?.();
      }
      if (action === 'closeMenu') closeMenu();
      if (action === 'back') {
        closeMenu();
        setMonthPickerOpen(false);
        onNativeBack?.();
      }
      if (action === 'save') {
        closeMenu();
        setMonthPickerOpen(false);
        onNativeSave?.();
      }
      if (action === 'prevMonth') {
        setMonthPickerOpen(false);
        calendarNav?.onPrev();
      }
      if (action === 'nextMonth') {
        setMonthPickerOpen(false);
        calendarNav?.onNext();
      }
      if (action === 'openMonthPicker' && calendarNav) {
        closeMenu();
        setMonthPickerOpen((open) => !open);
      }
      if (action === 'selectMonth' && calendarNav && payload) {
        const year = payload.year;
        const month = payload.month;
        if (typeof year === 'number' && typeof month === 'number') {
          calendarNav.onSelectMonth(year, month);
        }
      }
    };
    return () => {
      delete window.diaryHeaderAction;
    };
  }, [calendarNav, closeMenu, menuClosing, menuVisible, onNativeBack, onNativeSave, onOpenSearch, openMenu]);

  const closeAnd = (fn?: () => void) => {
    closeMenu();
    setMonthPickerOpen(false);
    fn?.();
  };

  const accountHint = nickname.trim()
    ? nickname.trim()
    : t('header.accountHintEmpty');

  const menu =
    menuVisible &&
    createPortal(
      <div
        className={`header-menu${menuClosing ? ' is-closing' : ''}`}
        role="dialog"
        aria-label={t('header.menu')}
        aria-hidden={menuClosing}
      >
        <div className="header-menu__backdrop" onClick={closeMenu} />
        <nav
          className="header-menu__panel"
          onAnimationEnd={(e) => {
            if (!menuClosing || e.target !== e.currentTarget) return;
            if (e.animationName !== 'header-menu-out') return;
            finishMenuClose();
          }}
        >
          <ul className="header-menu__list">
            {onOpenAccount && (
              <MenuItem
                icon={
                  avatarUrl ? (
                    <img src={avatarUrl} alt="" className="header-menu__avatar-img" />
                  ) : (
                    <IconUser />
                  )
                }
                label={t('header.account')}
                hint={accountHint}
                tone="cream"
                onClick={() => closeAnd(onOpenAccount)}
              />
            )}
            {onOpenLanguage && (
              <MenuItem
                icon={<IconGlobe />}
                label={t('header.language')}
                tone="mint"
                onClick={() => closeAnd(onOpenLanguage)}
              />
            )}
            {onToggleScreenLock && (
              <MenuToggleItem
                icon={<IconLock />}
                label={t('header.screenLock')}
                checked={screenLockEnabled}
                tone="lavender"
                onToggle={() => closeAnd(onToggleScreenLock)}
              />
            )}
            {onOpenRooms && (
              <MenuItem
                icon={<IconUsers />}
                label={t('header.rooms')}
                tone="lavender"
                onClick={() => closeAnd(onOpenRooms)}
              />
            )}
            {onOpenDecorate && (
              <MenuItem
                icon={<IconPalette />}
                label={t('header.decorate')}
                tone="peach"
                onClick={() => closeAnd(onOpenDecorate)}
              />
            )}
            {onOpenExport && (
              <MenuItem
                icon={<IconDownload />}
                label={t('header.export')}
                tone="mint"
                onClick={() => closeAnd(onOpenExport)}
              />
            )}
            {onOpenAppInfo && (
              <MenuItem
                icon={<IconInfo />}
                label={t('header.appInfo')}
                tone="cream"
                onClick={() => closeAnd(onOpenAppInfo)}
              />
            )}
          </ul>
        </nav>
      </div>,
      document.getElementById('root') ?? document.body,
    );

  const picker =
    monthPickerOpen && calendarNav ? (
      <MonthYearPicker
        year={calendarNav.year}
        month={calendarNav.month}
        onClose={() => setMonthPickerOpen(false)}
        onSelect={(year, month) => {
          calendarNav.onSelectMonth(year, month);
          setMonthPickerOpen(false);
        }}
      />
    ) : null;

  if (hideBar) {
    return (
      <>
        {picker}
        {menu}
      </>
    );
  }

  return (
    <header className="header">
      {calendarNav ? (
        <div className="header__calendar-nav">
          <button
            type="button"
            className="header__month-btn"
            onClick={() => {
              setMonthPickerOpen(false);
              calendarNav.onPrev();
            }}
            aria-label={t('calendar.prevMonth')}
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="header__month-label"
            aria-label={t('calendar.pickYearMonthAria')}
            aria-expanded={monthPickerOpen}
            onClick={() => setMonthPickerOpen((open) => !open)}
          >
            {formatYearMonth(calendarNav.year, calendarNav.month)}
          </button>
          <button
            type="button"
            className="header__month-btn"
            onClick={() => {
              setMonthPickerOpen(false);
              calendarNav.onNext();
            }}
            aria-label={t('calendar.nextMonth')}
          >
            <IconChevronRight />
          </button>
          {picker}
        </div>
      ) : (
        <span className="header__spacer" aria-hidden />
      )}
      <div className="header__actions">
        {onOpenSearch && (
          <button
            type="button"
            className="header__burger"
            aria-label={t('header.search')}
            title={t('header.searchHint')}
            onClick={() => {
              closeMenu();
              setMonthPickerOpen(false);
              onOpenSearch();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="header__burger"
          aria-label={t('header.menu')}
          onClick={openMenu}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 5h16" />
            <path d="M4 12h16" />
            <path d="M4 19h16" />
          </svg>
        </button>
      </div>
      {menu}
    </header>
  );
}

export default Header;

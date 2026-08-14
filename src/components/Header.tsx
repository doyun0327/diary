import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
// import { formatYearMonth } from '../utils/date';
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
  calendarNav?: {
    year: number;
    month: number;
    onPrev: () => void;
    onNext: () => void;
    onSelectMonth: (year: number, month: number) => void;
  } | null;
  /** Flutter AppBar 사용 시 웹 상단 바만 숨기고 메뉴는 유지 */
  hideBar?: boolean;
}

function CrayonSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
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
      <text
        x="12"
        y="16.8"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Gaegu, Hi Melody, cursive"
        fontSize="14"
        fontWeight="800"
        stroke="currentColor"
        strokeWidth="0.45"
        strokeLinejoin="round"
        paintOrder="stroke fill"
        letterSpacing="0.15"
      >
        ABC
      </text>
    </CrayonSvg>
  );
}

function IconLock() {
  return (
    <CrayonSvg>
      <path
        d="M8.1 10.6V8.4c.1-2.1 1.6-3.9 3.8-4 2.3-.1 4.1 1.6 4.2 3.8v2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.2 11.2c-.2-.2 0-1 1.1-1.2h9.2c1.2.1 1.6.9 1.5 1.8l-.5 7.1c-.1 1.2-.9 1.9-2.1 2H8.4c-1.3.1-2.1-.7-2.2-2l-.1-7.7Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14.1c.7 0 1.2.6 1.1 1.2 0 .4-.2.7-.5.9v1.2c0 .3-.3.5-.6.5s-.6-.2-.6-.5v-1.2c-.3-.2-.5-.5-.5-.9.1-.6.6-1.2 1.1-1.2Z"
        fill="currentColor"
      />
    </CrayonSvg>
  );
}

function IconUsers() {
  return (
    <CrayonSvg>
      <ellipse cx="7.2" cy="7.3" rx="2.9" ry="3" fill="currentColor" fillOpacity="0.12" />
      <path
        d="M4.5 7.4c.2-1.7 1.4-3 2.9-3.1 1.6-.1 2.9 1.1 3 2.8.1 1.7-1.1 3.1-2.8 3.2-1.6.1-3.1-1.2-3.1-2.9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M3.6 19.5c-.2-3.2 1-5.5 3.8-5.7 2.7-.2 4.2 1.9 4.2 5.1 0 .7-.4 1.1-1.1 1.2H4.6c-.7 0-1-.4-1-.6Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="16.8" cy="7.3" rx="2.9" ry="3" fill="currentColor" fillOpacity="0.12" />
      <path
        d="M14.1 7.4c.2-1.7 1.4-3 2.9-3.1 1.6-.1 2.9 1.1 3 2.8.1 1.7-1.1 3.1-2.8 3.2-1.6.1-3.1-1.2-3.1-2.9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M13.2 19.5c-.2-3.2 1-5.5 3.8-5.7 2.7-.2 4.2 1.9 4.2 5.1 0 .7-.4 1.1-1.1 1.2h-5.8c-.7 0-1.1-.4-1.1-.6Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </CrayonSvg>
  );
}

function IconPalette() {
  return (
    <CrayonSvg>
      <path
        d="M8.2 16.6c-2.2.1-3.8-1.5-3.7-3.5.1-1.9 1.8-3.3 3.8-3.2 2 .1 3.4 1.8 3.3 3.6-.1 1.9-1.6 3-3.4 3.1Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M15.8 16.4c-2.1.2-3.6-1.3-3.6-3.3 0-1.9 1.6-3.5 3.6-3.5 2.1 0 3.6 1.6 3.6 3.5 0 2-1.5 3.2-3.6 3.3Z"
        fill="currentColor"
        fillOpacity="0.28"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12 10.6c-2.2.1-3.7-1.5-3.6-3.4.1-2 1.8-3.5 3.8-3.5 2.1 0 3.6 1.6 3.5 3.6-.1 1.9-1.6 3.2-3.7 3.3Z"
        fill="currentColor"
        fillOpacity="0.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="10.8" cy="6.6" r="0.7" fill="currentColor" fillOpacity="0.55" />
      <circle cx="14.4" cy="12.2" r="0.55" fill="currentColor" fillOpacity="0.45" />
    </CrayonSvg>
  );
}

function IconDownload() {
  return (
    <CrayonSvg>
      <path
        d="M4.6 13.2c-.6-.2-.6-1.2.1-1.6L18.8 4.4c.8-.4 1.6.4 1.3 1.2l-4.8 14.2c-.3.8-1.4.9-1.8.1l-2.6-5.2-6.3-1.5Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.2 13.1 19.4 5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </CrayonSvg>
  );
}

function IconInfo() {
  return (
    <CrayonSvg>
      <path
        d="M12.1 3.4c.6-.2 1.3.2 1.5.8l1.6 4.8 5.1.3c.7 0 1.1.8.7 1.3l-3.8 3.5 1.2 5c.2.6-.5 1.2-1.1.9L12 17.6 7.7 20c-.6.3-1.3-.3-1.1-.9l1.2-5-3.8-3.5c-.4-.5 0-1.3.7-1.3l5.1-.3 1.6-4.8c.2-.6.9-1 1.5-.8Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </CrayonSvg>
  );
}

/*
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
*/

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
  hideBar: _hideBar = false,
}: HeaderProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!calendarNav) setMonthPickerOpen(false);
  }, [calendarNav]);

  useEffect(() => {
    window.diaryHeaderAction = (action, payload) => {
      if (action === 'openMenu') {
        setMonthPickerOpen(false);
        setMenuOpen((open) => !open);
      }
      if (action === 'closeMenu') setMenuOpen(false);
      if (action === 'prevMonth') {
        setMonthPickerOpen(false);
        calendarNav?.onPrev();
      }
      if (action === 'nextMonth') {
        setMonthPickerOpen(false);
        calendarNav?.onNext();
      }
      if (action === 'openMonthPicker' && calendarNav) {
        setMenuOpen(false);
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
  }, [calendarNav]);

  const closeAnd = (fn?: () => void) => {
    setMenuOpen(false);
    setMonthPickerOpen(false);
    fn?.();
  };

  const accountHint = nickname.trim()
    ? nickname.trim()
    : t('header.accountHintEmpty');

  const menu =
    menuOpen &&
    createPortal(
      <div className="header-menu" role="dialog" aria-label={t('header.menu')}>
        <div className="header-menu__backdrop" onClick={() => setMenuOpen(false)} />
        <nav className="header-menu__panel">
          <header className="header-menu__head">
            <div className="header-menu__brand">
              <p className="header-menu__brand-title">PageBy</p>
              <p className="header-menu__brand-sub">{t('header.tagline')}</p>
            </div>
          </header>

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

          <p className="header-menu__foot">{t('header.footer')}</p>
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

  // 웹 상단 바는 Flutter AppBar로 이동. 메뉴/월 선택만 웹에서 유지.
  return (
    <>
      {picker}
      {menu}
    </>
  );

  /*
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
      <button
        type="button"
        className="header__burger"
        aria-label={t('header.menu')}
        onClick={() => setMenuOpen(true)}
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
      {menu}
    </header>
  );
  */
}

export default Header;

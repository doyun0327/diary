import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatYearMonth } from '../utils/date';
import {
  getDiaryAccessState,
  subscribeDiaryAccess,
} from '../utils/diaryAccess';
import { getAccessToken } from '../hooks/useAuthSession';
import { getCachedRoomFeed, getCachedRoomsList } from '../utils/roomCache';
import { prefetchRoomFeed, prefetchRoomsList } from '../utils/roomPrefetch';
import {
  roomHasUnreadPosts,
  syncRoomPostsSeenBaseline,
} from '../utils/roomPostSeen';
import MonthYearPicker from './MonthYearPicker';
import './Header.css';

interface HeaderProps {
  nickname?: string;
  avatarUrl?: string | null;
  /** 친구방 새 일기 N 배지용 (세션 userId) */
  roomsUserId?: string | null;
  onOpenAccount?: () => void;
  onOpenLanguage?: () => void;
  onOpenNyangTicket?: () => void;
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

function IconTicket() {
  return (
    <CrayonSvg>
      {/* 다른 메뉴 아이콘과 비슷한 시각 크기 */}
      <g transform="translate(0.5 1.2) scale(0.95)">
        <path
          d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 티켓 안 원화(₩) */}
        <path
          d="M9.2 9.4 12 16.2 14.8 9.4"
          stroke="currentColor"
          strokeWidth="1.55"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="8.4"
          y1="11.5"
          x2="15.6"
          y2="11.5"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinecap="round"
        />
        <line
          x1="8.6"
          y1="13.5"
          x2="15.4"
          y2="13.5"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinecap="round"
        />
      </g>
    </CrayonSvg>
  );
}

/* 화면 잠금 메뉴 임시 비활성
function IconLock() {
  return (
    <CrayonSvg>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </CrayonSvg>
  );
}
*/

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
  badge,
  badgeAria,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  tone?: 'peach' | 'mint' | 'lavender' | 'cream';
  /** 예: 친구방 새 일기 N */
  badge?: string;
  badgeAria?: string;
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
          <span className="header-menu__label-row">
            <span className="header-menu__label">{label}</span>
            {badge ? (
              <span className="header-menu__new" aria-label={badgeAria || badge}>
                {badge}
              </span>
            ) : null}
          </span>
          {hint ? <span className="header-menu__hint">{hint}</span> : null}
        </span>
      </button>
    </li>
  );
}

/* 화면 잠금 메뉴 임시 비활성
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
*/

function Header({
  nickname = '',
  avatarUrl = null,
  roomsUserId = null,
  onOpenAccount,
  onOpenLanguage,
  onOpenNyangTicket,
  // screenLockEnabled = false,
  // onToggleScreenLock,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [accessTick, setAccessTick] = useState(0);
  const [roomsHasNew, setRoomsHasNew] = useState(false);

  useEffect(() => subscribeDiaryAccess(() => setAccessTick((n) => n + 1)), []);

  // 메뉴 열릴 때만 PageBy 새 일기 N 갱신
  useEffect(() => {
    if (!menuOpen || !onOpenRooms) return;
    let cancelled = false;
    void (async () => {
      if (!getAccessToken()) {
        if (!cancelled) setRoomsHasNew(false);
        return;
      }
      try {
        let list = getCachedRoomsList(0, 10);
        if (!list) {
          list = (await prefetchRoomsList(0, 10)) ?? null;
        }
        const rooms = list?.content ?? [];
        const ids = rooms
          .map((r) => r.id)
          .filter(Boolean)
          .slice(0, 5);
        await Promise.all(
          ids.map((id) =>
            prefetchRoomFeed(id, { page: 0, size: 10, force: true }).catch(
              () => {},
            ),
          ),
        );
        if (cancelled) return;
        let has = false;
        const me = roomsUserId?.trim() || '';
        for (const id of ids) {
          const feed = getCachedRoomFeed(id, 0, 10, { allowStale: true });
          if (!feed?.posts?.length) continue;
          syncRoomPostsSeenBaseline(
            id,
            feed.posts.map((p) => p.id),
          );
          if (roomHasUnreadPosts(id, feed.posts, me)) {
            has = true;
            break;
          }
        }
        setRoomsHasNew(has);
      } catch {
        if (!cancelled) setRoomsHasNew(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuOpen, onOpenRooms, roomsUserId]);

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
      if (action === 'openSearch') {
        setMenuOpen(false);
        setMonthPickerOpen(false);
        onOpenSearch?.();
      }
      if (action === 'closeMenu') setMenuOpen(false);
      if (action === 'back') {
        setMenuOpen(false);
        setMonthPickerOpen(false);
        onNativeBack?.();
      }
      if (action === 'save') {
        setMenuOpen(false);
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
  }, [calendarNav, onNativeBack, onNativeSave, onOpenSearch]);

  const closeAnd = (fn?: () => void) => {
    setMenuOpen(false);
    setMonthPickerOpen(false);
    fn?.();
  };

  const accountHint = nickname.trim()
    ? nickname.trim()
    : t('header.accountHintEmpty');
  void accessTick;
  const isPro = getDiaryAccessState().isPremiumActive;

  const menu =
    menuOpen &&
    createPortal(
      <div className="header-menu" role="dialog" aria-label={t('header.menu')}>
        <div className="header-menu__backdrop" onClick={() => setMenuOpen(false)} />
        <nav className="header-menu__panel">
          <ul className="header-menu__list">
            {onOpenAccount && (
              <li>
                <div className="header-menu__item header-menu__item--cream header-menu__item--account">
                  <button
                    type="button"
                    className="header-menu__account-main"
                    onClick={() => closeAnd(onOpenAccount)}
                  >
                    <span className="header-menu__icon">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="header-menu__avatar-img" />
                      ) : (
                        <IconUser />
                      )}
                    </span>
                    <span className="header-menu__text">
                      <span className="header-menu__label">{t('header.account')}</span>
                      <span className="header-menu__hint">{accountHint}</span>
                    </span>
                  </button>
                  {isPro && onOpenNyangTicket ? (
                    <button
                      type="button"
                      className="header-menu__sub-badge is-pro"
                      onClick={() => closeAnd(onOpenNyangTicket)}
                    >
                      {t('header.subscribed')}
                    </button>
                  ) : isPro ? (
                    <span className="header-menu__sub-badge is-pro">
                      {t('header.subscribed')}
                    </span>
                  ) : onOpenNyangTicket ? (
                    <button
                      type="button"
                      className="header-menu__sub-badge is-cta"
                      onClick={() => closeAnd(onOpenNyangTicket)}
                    >
                      {t('header.subscribeCta')}
                    </button>
                  ) : null}
                </div>
              </li>
            )}
            {onOpenLanguage && (
              <MenuItem
                icon={<IconGlobe />}
                label={t('header.language')}
                tone="mint"
                onClick={() => closeAnd(onOpenLanguage)}
              />
            )}
            {onOpenRooms && (
              <MenuItem
                icon={<IconUsers />}
                label={t('header.rooms')}
                tone="lavender"
                badge={roomsHasNew ? t('rooms.postNew') : undefined}
                badgeAria={t('rooms.postNewAria')}
                onClick={() => closeAnd(onOpenRooms)}
              />
            )}
            {onOpenNyangTicket && (
              <MenuItem
                icon={<IconTicket />}
                label={t('header.nyangTicket')}
                tone="peach"
                onClick={() => closeAnd(onOpenNyangTicket)}
              />
            )}
            {/* 화면 잠금 메뉴 임시 비활성
            {onToggleScreenLock && (
              <MenuToggleItem
                icon={<IconLock />}
                label={t('header.screenLock')}
                checked={screenLockEnabled}
                tone="lavender"
                onToggle={() => closeAnd(onToggleScreenLock)}
              />
            )}
            */}
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
              setMenuOpen(false);
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
      </div>
      {menu}
    </header>
  );
}

export default Header;

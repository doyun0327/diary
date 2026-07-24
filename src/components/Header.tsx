import { useEffect, useState, type ReactNode } from 'react';
import './Header.css';

interface HeaderProps {
  onOpenCharacter?: () => void;
  onOpenExport?: () => void;
  onOpenRooms?: () => void;
}

function IconUser() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" className="header-menu__item" onClick={onClick}>
        <span className="header-menu__icon">{icon}</span>
        <span className="header-menu__text">
          <span className="header-menu__label">{label}</span>
          <span className="header-menu__hint">{hint}</span>
        </span>
        <span className="header-menu__chevron">
          <IconChevron />
        </span>
      </button>
    </li>
  );
}

function Header({ onOpenCharacter, onOpenExport, onOpenRooms }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const closeAnd = (fn?: () => void) => {
    setMenuOpen(false);
    fn?.();
  };

  return (
    <header className="header">
      <h1 className="header__logo">diary</h1>
      <button
        type="button"
        className="header__burger"
        aria-label="메뉴"
        aria-expanded={menuOpen}
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

      {menuOpen && (
        <div className="header-menu" role="dialog" aria-label="메뉴">
          <div className="header-menu__backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="header-menu__panel">
            <div className="header-menu__glow" aria-hidden />
            <header className="header-menu__head">
              <div className="header-menu__brand">
                <p className="header-menu__brand-name">diary</p>
                <p className="header-menu__brand-sub">나의 하루를 남기다</p>
              </div>
              <button
                type="button"
                className="header-menu__close"
                onClick={() => setMenuOpen(false)}
                aria-label="닫기"
              >
                <IconClose />
              </button>
            </header>

            <p className="header-menu__section">설정</p>
            <ul className="header-menu__list">
              {onOpenRooms && (
                <MenuItem
                  icon={<IconUsers />}
                  label="친구 방"
                  hint="내 방 목록"
                  onClick={() => closeAnd(onOpenRooms)}
                />
              )}
              {onOpenCharacter && (
                <MenuItem
                  icon={<IconUser />}
                  label="캐릭터"
                  hint="AI 그림 속 나"
                  onClick={() => closeAnd(onOpenCharacter)}
                />
              )}
              {onOpenExport && (
                <MenuItem
                  icon={<IconDownload />}
                  label="내보내기"
                  hint="기간 PDF · 일기장"
                  onClick={() => closeAnd(onOpenExport)}
                />
              )}
            </ul>

            <p className="header-menu__foot">천천히, 하루씩</p>
          </nav>
        </div>
      )}
    </header>
  );
}

export default Header;

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './Header.css';

interface HeaderProps {
  nickname?: string;
  avatarUrl?: string | null;
  onOpenAccount?: () => void;
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

function MenuItem({
  icon,
  label,
  hint,
  tone = 'peach',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
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
          <span className="header-menu__hint">{hint}</span>
        </span>
      </button>
    </li>
  );
}

function Header({
  nickname = '',
  avatarUrl = null,
  onOpenAccount,
  onOpenCharacter,
  onOpenExport,
  onOpenRooms,
}: HeaderProps) {
  const { t } = useTranslation();
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
              <img
                src="/brand/PageByImg.png?v=2"
                alt="PageBy"
                className="header-menu__brand-logo"
              />
              <p className="header-menu__brand-sub">{t('header.tagline')}</p>
            </div>
            {/* <button
              type="button"
              className="header-menu__close"
              onClick={() => setMenuOpen(false)}
              aria-label={t('common.close')}
            >
              <IconClose />
            </button> */}
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
            {onOpenRooms && (
              <MenuItem
                icon={<IconUsers />}
                label={t('header.rooms')}
                hint={t('header.roomsHint')}
                tone="lavender"
                onClick={() => closeAnd(onOpenRooms)}
              />
            )}
            {onOpenCharacter && (
              <MenuItem
                icon={<IconUser />}
                label={t('header.character')}
                hint={t('header.characterHint')}
                tone="peach"
                onClick={() => closeAnd(onOpenCharacter)}
              />
            )}
            {onOpenExport && (
              <MenuItem
                icon={<IconDownload />}
                label={t('header.export')}
                hint={t('header.exportHint')}
                tone="mint"
                onClick={() => closeAnd(onOpenExport)}
              />
            )}
          </ul>

          <p className="header-menu__foot">{t('header.footer')}</p>
        </nav>
      </div>,
      document.getElementById('root') ?? document.body,
    );

  return (
    <header className="header">
      <h1 className="header__logo">
        <img
          src="/brand/my-cozy-diary.png?v=4"
          alt=""
          className="header__logo-img"
        />
        <img
          src="/brand/PageByImg.png?v=2"
          alt="PageBy"
          className="header__logo-wordmark"
        />
      </h1>
      <button
        type="button"
        className="header__burger"
        aria-label={t('header.menu')}
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
      {menu}
    </header>
  );
}

export default Header;

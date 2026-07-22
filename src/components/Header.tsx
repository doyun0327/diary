import FontPicker from './FontPicker';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <h1 className="header__logo">🎨 그림 일기</h1>
      <div className="header__actions">
        <FontPicker />
      </div>
    </header>
  );
}

export default Header;

import './WriteFab.css';

interface WriteFabProps {
  onClick: () => void;
}

function WriteFab({ onClick }: WriteFabProps) {
  return (
    <button type="button" className="write-fab" aria-label="일기 쓰기" onClick={onClick}>
      +
    </button>
  );
}

export default WriteFab;

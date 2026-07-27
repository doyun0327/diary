import { useTranslation } from 'react-i18next';
import './WriteFab.css';

interface WriteFabProps {
  onClick: () => void;
}

function WriteFab({ onClick }: WriteFabProps) {
  const { t } = useTranslation();

  return (
    <button type="button" className="write-fab" aria-label={t('diary.writeFabAria')} onClick={onClick}>
      +
    </button>
  );
}

export default WriteFab;

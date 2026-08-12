import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getPagerWindow } from '../utils/pagerWindow';
import './PagePager.css';

const DEFAULT_WINDOW_SIZE = 5;

interface PagePagerProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  windowSize?: number;
  className?: string;
}

function PagePager({
  page,
  pageCount,
  onPageChange,
  disabled = false,
  windowSize = DEFAULT_WINDOW_SIZE,
  className,
}: PagePagerProps) {
  const { t } = useTranslation();
  const visiblePages = useMemo(
    () => getPagerWindow(page, pageCount, windowSize),
    [page, pageCount, windowSize],
  );

  if (pageCount <= 1) return null;

  const rootClass = className ? `page-pager ${className}` : 'page-pager';

  return (
    <nav className={rootClass} aria-label={t('common.pagerAria')}>
      <button
        type="button"
        className="page-pager__arrow"
        disabled={disabled || page <= 0}
        onClick={() => onPageChange(Math.max(0, page - 1))}
        aria-label={t('common.pagePrevAria')}
      >
        &lt;
      </button>
      <div className="page-pager__numbers" role="group" aria-label={t('common.pagerPagesAria')}>
        {visiblePages.map((pageIndex) => {
          const label = pageIndex + 1;
          const isActive = pageIndex === page;
          return (
            <button
              key={pageIndex}
              type="button"
              className={`page-pager__num${isActive ? ' is-active' : ''}`}
              disabled={disabled}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t('common.pageGoAria', { page: label })}
              onClick={() => onPageChange(pageIndex)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="page-pager__arrow"
        disabled={disabled || page >= pageCount - 1}
        onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        aria-label={t('common.pageNextAria')}
      >
        &gt;
      </button>
    </nav>
  );
}

export default PagePager;

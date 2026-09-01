import { useEffect, useState } from 'react';
import { cropDrawingBottomWhitespace } from '../utils/cropDrawingBottomWhitespace';

/** 일기 그림 하단 여백(구 도구줄) 제거 — 상세·목록 썸네일 공통 */
export function useCroppedDiaryImage(src: string): string {
  const [displaySrc, setDisplaySrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    setDisplaySrc(src);
    void cropDrawingBottomWhitespace(src).then((next) => {
      if (!cancelled) setDisplaySrc(next);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return displaySrc;
}

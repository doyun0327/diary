import { captureDiaryPaperBlob } from './captureDiaryPaper';
import { saveOrShareBlob } from './saveBlob';

/** 화면의 diary-detail__paper 를 그대로 PNG로 저장/공유 */
export async function downloadDiaryPaperPng(
  element: HTMLElement,
  date: string,
  fontId?: string,
): Promise<void> {
  const blob = await captureDiaryPaperBlob(element, fontId);
  const yyyymmdd = date.replace(/-/g, '');
  const filename = `${yyyymmdd}_PageBy.png`;
  const result = await saveOrShareBlob(blob, filename, {
    title: filename,
    text: 'PageBy 일기',
  });
  if (result === 'cancelled') return;
}

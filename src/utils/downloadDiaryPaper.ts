import { downloadBlob } from './diaryBook';
import { captureDiaryPaperBlob } from './captureDiaryPaper';

/** 화면의 diary-detail__paper 를 그대로 PNG로 저장 */
export async function downloadDiaryPaperPng(
  element: HTMLElement,
  date: string,
  fontId?: string,
): Promise<void> {
  const blob = await captureDiaryPaperBlob(element, fontId);
  const yyyymmdd = date.replace(/-/g, '');
  downloadBlob(blob, `${yyyymmdd}_PageBy.png`);
}

import type { DiaryEntry } from '../types/diary';
import { captureDiaryEntryPaperBlob } from './captureDiaryPaper';

export type ShareTarget = 'sns';

export type ShareResult =
  | 'shared'
  | 'downloaded'
  | { type: 'downloaded'; previewUrl: string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // URL은 미리보기에서도 쓸 수 있어 호출측에서 revoke
  return url;
}

/** 모바일에서 파일 공유(Web Share) 지원 여부 — PC 웹은 보통 false */
export function canShareImageFile(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'p.png', {
      type: 'image/png',
    });
    if (typeof navigator.canShare === 'function') {
      return navigator.canShare({ files: [probe] });
    }
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

async function tryNativeShare(file: File, title: string, text: string): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false;

  const payload = { files: [file], title, text };
  const ok =
    typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
  if (!ok) return false;

  try {
    await navigator.share(payload);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return false;
  }
}

/**
 * SNS 공유 (인스타·카카오톡 등 시스템 공유 시트)
 * - 상세의 diary-detail__paper 를 그대로 캡처해 공유
 * - 폰: 시스템 공유 시트 → 원하는 앱 선택
 * - PC 웹: 이미지 다운로드 (앱 공유 API 미지원)
 */
export async function shareDiaryTo(
  entry: DiaryEntry,
  _target: ShareTarget = 'sns',
  options?: { paperElement?: HTMLElement | null },
): Promise<{ result: 'shared' | 'downloaded'; previewUrl?: string; isMobileShare: boolean }> {
  const blob = await captureDiaryEntryPaperBlob(entry, options?.paperElement);
  const filename = `diary-${entry.date}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  const title = entry.title || 'diary';
  const text = '내 diary를 SNS로 공유해요';

  const isMobileShare = canShareImageFile();

  if (isMobileShare) {
    const shared = await tryNativeShare(file, title, text);
    if (shared) {
      return { result: 'shared', isMobileShare: true };
    }
  }

  const previewUrl = downloadBlob(blob, filename);
  return { result: 'downloaded', previewUrl, isMobileShare };
}

import { isFlutterApp, saveFileViaNative, shareViaNative } from './nativeShare';

export type SaveBlobResult =
  | 'shared'
  | 'downloaded'
  | 'opened'
  | 'cancelled'
  | 'needsGesture';

function mimeFromFilename(filename: string): string {
  if (filename.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (filename.toLowerCase().endsWith('.png')) return 'image/png';
  if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return 'application/octet-stream';
}

/** 터치 모바일(또는 iPad)로 보이는지 */
export function isLikelyMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform);
}

export function canShareFile(file: File): boolean {
  if (isFlutterApp()) return true;
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    if (typeof navigator.canShare === 'function') {
      return navigator.canShare({ files: [file] });
    }
    return isLikelyMobile();
  } catch {
    return false;
  }
}

export function canSharePdfFile(): boolean {
  try {
    const probe = new File([new Blob(['%PDF'], { type: 'application/pdf' })], 'diary.pdf', {
      type: 'application/pdf',
    });
    return canShareFile(probe);
  } catch {
    return false;
  }
}

/** PC용: a[download] + revoke 지연 */
export function downloadViaAnchor(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 모바일 폴백: PDF/이미지를 새 탭(또는 동일 탭)에서 열어 저장하게 함 */
export function openBlobInViewer(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 뷰어가 로드될 때까지 URL 유지
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * 파일 저장/공유
 * - 모바일: Web Share(파일) 우선 → 실패 시 뷰어로 열기
 * - PC: download 속성으로 저장
 * - shareOnly: 공유만 시도. 실패하면 needsGesture (두 번째 탭용)
 */
export async function saveOrShareBlob(
  blob: Blob,
  filename: string,
  options?: {
    title?: string;
    text?: string;
    forceOpen?: boolean;
    shareOnly?: boolean;
  },
): Promise<SaveBlobResult> {
  const type = blob.type || mimeFromFilename(filename);
  const file = new File([blob], filename, { type });
  const mobile = isLikelyMobile();

  if (!options?.forceOpen && canShareFile(file)) {
    try {
      if (
        await shareViaNative({
          title: options?.title ?? filename,
          text: options?.text ?? '',
          file,
          filename,
        })
      ) {
        return 'shared';
      }
      await navigator.share({
        files: [file],
        title: options?.title ?? filename,
        text: options?.text ?? '',
      });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      if (options?.shareOnly) return 'needsGesture';
      // 공유 실패 → 아래로 폴백
    }
  } else if (options?.shareOnly) {
    return 'needsGesture';
  }

  if (mobile || options?.forceOpen) {
    openBlobInViewer(blob);
    return 'opened';
  }

  downloadViaAnchor(blob, filename);
  return 'downloaded';
}

/**
 * 기기 로컬에 저장 (공유 시트 없음)
 * - Flutter: 네이티브 Downloads / Documents
 * - 그 외: a[download]
 */
export async function downloadToDevice(
  blob: Blob,
  filename: string,
): Promise<SaveBlobResult> {
  if (await saveFileViaNative({ file: blob, filename })) {
    return 'downloaded';
  }
  downloadViaAnchor(blob, filename);
  return 'downloaded';
}

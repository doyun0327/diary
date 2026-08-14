declare global {
  interface Window {
    DiaryNative?: { postMessage: (message: string) => void };
    __DIARY_FLUTTER__?: boolean;
    __onDiaryGoogleIdToken?: (idToken: string) => void;
    __onDiaryGoogleSignInError?: (reason: string) => void;
    diaryGoBack?: () => boolean;
  }
}

function diaryNative(): { postMessage: (message: string) => void } | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.DiaryNative ?? (globalThis as unknown as { DiaryNative?: typeof window.DiaryNative }).DiaryNative;
}

export function isFlutterApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__DIARY_FLUTTER__ === true) return true;
  return typeof diaryNative()?.postMessage === 'function';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Flutter WebView면 네이티브 공유 시트로 넘기고 true. 아니면 false. */
export async function shareViaNative(payload: {
  title?: string;
  text?: string;
  url?: string;
  file?: Blob;
  filename?: string;
}): Promise<boolean> {
  if (!isFlutterApp()) return false;

  if (payload.file) {
    const filename =
      payload.filename ||
      (payload.file instanceof File && payload.file.name) ||
      'share.bin';
    const mime =
      payload.file.type ||
      (filename.toLowerCase().endsWith('.png')
        ? 'image/png'
        : filename.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'application/octet-stream');
    diaryNative()!.postMessage(
      JSON.stringify({
        type: 'shareFile',
        title: payload.title ?? '',
        text: payload.text ?? '',
        url: payload.url ?? '',
        name: filename,
        mime,
        base64: await blobToBase64(payload.file),
      }),
    );
    return true;
  }

  diaryNative()!.postMessage(
    JSON.stringify({
      type: 'share',
      title: payload.title ?? '',
      text: payload.text ?? '',
      url: payload.url ?? '',
    }),
  );
  return true;
}

/** Flutter WebView면 네이티브 다운로드로 넘기고 true. 아니면 false. */
export async function saveFileViaNative(payload: {
  file: Blob;
  filename?: string;
}): Promise<boolean> {
  if (!isFlutterApp()) return false;

  const filename =
    payload.filename ||
    (payload.file instanceof File && payload.file.name) ||
    'download.bin';
  const mime =
    payload.file.type ||
    (filename.toLowerCase().endsWith('.png')
      ? 'image/png'
      : filename.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'application/octet-stream');
  diaryNative()!.postMessage(
    JSON.stringify({
      type: 'saveFile',
      name: filename,
      mime,
      base64: await blobToBase64(payload.file),
    }),
  );
  return true;
}

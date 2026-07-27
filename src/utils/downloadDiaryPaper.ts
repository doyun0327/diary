import { domToBlob } from 'modern-screenshot';
import { downloadBlob } from './diaryBook';

const CAPTURE_STYLE_PROPS = [
  'display',
  'flex-direction',
  'flex-wrap',
  'align-items',
  'justify-content',
  'align-content',
  'gap',
  'row-gap',
  'column-gap',
  'position',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin',
  'padding',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'background',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'box-shadow',
  'overflow',
  'overflow-x',
  'overflow-y',
  'opacity',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variant',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'white-space',
  'word-break',
  'overflow-wrap',
  'vertical-align',
  'object-fit',
  'object-position',
] as const;

const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

function getDiaryFontFamily(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--diary-font')
    .trim();
  return raw || "'Gaegu', cursive";
}

/** "'Gaegu', cursive" → Gaegu */
function primaryFontName(fontFamily: string): string {
  const first = fontFamily.split(',')[0]?.trim() ?? 'Gaegu';
  return first.replace(/^['"]|['"]$/g, '');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Google Fonts CSS를 data URL 폰트로 바꿔 캡처 SVG에 심음 */
async function buildEmbeddedFontCss(fontFamily: string): Promise<string> {
  const name = primaryFontName(fontFamily);
  if (!name || name === 'cursive' || name === 'sans-serif') return '';

  try {
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;700&display=swap`;
    let css = await fetch(cssUrl).then((r) => {
      if (!r.ok) throw new Error(`font css ${r.status}`);
      return r.text();
    });

    const urls = [
      ...css.matchAll(/url\(([^)]+)\)/g),
    ].map((m) => m[1].replace(/['"]/g, ''));

    await Promise.all(
      urls.map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const mime =
          res.headers.get('content-type') ||
          (url.includes('.woff2')
            ? 'font/woff2'
            : url.includes('.woff')
              ? 'font/woff'
              : 'font/ttf');
        const dataUrl = `data:${mime};base64,${arrayBufferToBase64(buf)}`;
        css = css.split(url).join(dataUrl);
      }),
    );

    return css;
  } catch {
    return '';
  }
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const onLoad = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('그림을 불러오지 못했어요'));
        };
        const cleanup = () => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
        };
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
      });
    }),
  );
}

function applyCaptureStyles(source: Element, cloned: Element, diaryFont: string) {
  if (!(source instanceof HTMLElement) || !(cloned instanceof HTMLElement)) return;

  const cs = getComputedStyle(source);
  for (const prop of CAPTURE_STYLE_PROPS) {
    cloned.style.setProperty(prop, cs.getPropertyValue(prop));
  }

  // rem/var 의존 제거 — 화면에서 계산된 px·실제 폰트명으로 고정
  if (
    source.classList.contains('diary-detail__dateline') ||
    source.classList.contains('diary-detail__title') ||
    source.classList.contains('diary-detail__content')
  ) {
    cloned.style.fontFamily = diaryFont;
  }

  if (source.classList.contains('diary-detail__mood')) {
    cloned.style.fontFamily = EMOJI_FONT;
    cloned.style.fontWeight = '400';
    cloned.style.lineHeight = '1';
  }

  if (source.classList.contains('diary-detail__paper')) {
    cloned.style.margin = '0';
    cloned.style.boxShadow = 'none';
  }
}

/** 화면의 diary-detail__paper 를 그대로 PNG로 저장 */
export async function downloadDiaryPaperPng(
  element: HTMLElement,
  date: string,
): Promise<void> {
  const diaryFont = getDiaryFontFamily();
  const fontName = primaryFontName(diaryFont);

  await waitForImages(element);
  if (document.fonts?.ready) await document.fonts.ready;
  try {
    await document.fonts.load(`400 24px "${fontName}"`);
    await document.fonts.load(`700 24px "${fontName}"`);
  } catch {
    // 시스템 폰트만 있는 경우 무시
  }

  const fontCss = await buildEmbeddedFontCss(diaryFont);

  const blob = await domToBlob(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    // CSS 변수(--*)가 Chrome에서 캡처를 망가뜨려서 화이트리스트만 사용
    includeStyleProperties: [...CAPTURE_STYLE_PROPS],
    font: fontCss ? { cssText: fontCss } : undefined,
    style: {
      margin: '0',
      boxShadow: 'none',
    },
    onCloneNode: (cloned) => {
      if (!(cloned instanceof HTMLElement)) return;
      const walk = (source: Element, clone: Element) => {
        applyCaptureStyles(source, clone, diaryFont);
        const sourceChildren = Array.from(source.children);
        const cloneChildren = Array.from(clone.children);
        const len = Math.min(sourceChildren.length, cloneChildren.length);
        for (let i = 0; i < len; i += 1) {
          walk(sourceChildren[i], cloneChildren[i]);
        }
      };
      walk(element, cloned);
    },
  });

  if (!blob) throw new Error('PNG를 만들지 못했어요');

  const yyyymmdd = date.replace(/-/g, '');
  downloadBlob(blob, `${yyyymmdd}_PageBy.png`);
}

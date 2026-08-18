import { domToBlob } from 'modern-screenshot';
import type { DiaryEntry } from '../types/diary';
import { formatDate } from './date';
import { diaryFontStack, findFont } from './fonts';
import { getMoodVisual, getStoredMoodPackId, MOOD_ICON_TRANSFORMS } from './moodPack';
/** PDF/공유 offscreen 렌더 시 상세 paper 스타일 필요 (상세 페이지를 안 거친 경우 대비) */
import '../pages/DiaryDetailPage.css';
import '../components/MoodIcon.css';

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
  'background-origin',
  'background-clip',
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

/** offscreen paper 기본 너비 — 상세 화면 모바일 paper와 비슷한 비율 */
export const OFFSCREEN_PAPER_WIDTH = 420;

function getDiaryFontFamily(from?: HTMLElement, fontId?: string): string {
  if (fontId) {
    return diaryFontStack(findFont(fontId).family);
  }
  if (from) {
    const fromEl = getComputedStyle(from).getPropertyValue('--diary-font').trim();
    if (fromEl) return fromEl;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--diary-font')
    .trim();
  return raw || diaryFontStack("'Gaegu', cursive");
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

const fontCssCache = new Map<string, Promise<string>>();
const loadedFontFaces = new Set<string>();
let fontsReadyOnce: Promise<void> | null = null;

function waitDocumentFonts(): Promise<void> {
  if (!fontsReadyOnce) {
    fontsReadyOnce = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  }
  return fontsReadyOnce;
}

/** Google Fonts CSS를 data URL 폰트로 바꿔 캡처 SVG에 심음 (폰트별 1회) */
function buildEmbeddedFontCss(fontFamily: string): Promise<string> {
  const name = primaryFontName(fontFamily);
  if (!name || name === 'cursive' || name === 'sans-serif') return Promise.resolve('');

  const cached = fontCssCache.get(name);
  if (cached) return cached;

  const pending = (async () => {
    try {
      const cssUrl =
        `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;700&display=swap`;
      let css = await fetch(cssUrl).then((r) => {
        if (!r.ok) throw new Error(`font css ${r.status}`);
        return r.text();
      });

      const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) =>
        m[1].replace(/['"]/g, ''),
      );

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
  })();

  fontCssCache.set(name, pending);
  return pending;
}

export type CapturePaperOptions = {
  scale?: number;
  type?: string;
  quality?: number;
};

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

  if (
    source.classList.contains('diary-detail__dateline') ||
    source.classList.contains('diary-detail__title') ||
    source.classList.contains('diary-detail__content')
  ) {
    cloned.style.fontFamily = diaryFont;
  }

  if (
    source.classList.contains('diary-detail__mood') ||
    source.classList.contains('mood-icon--emoji')
  ) {
    cloned.style.fontFamily = EMOJI_FONT;
    cloned.style.fontWeight = '400';
    cloned.style.lineHeight = '1';
  }

  if (source.classList.contains('diary-detail__paper')) {
    cloned.style.margin = '0';
    cloned.style.boxShadow = 'none';
  }
}

/**
 * 화면의 diary-detail__paper 를 그대로 Blob으로 캡처
 * (공유 / PNG / PDF 공통)
 */
export async function captureDiaryPaperBlob(
  element: HTMLElement,
  fontId?: string,
  options?: CapturePaperOptions,
): Promise<Blob> {
  const diaryFont = getDiaryFontFamily(element, fontId);
  const fontName = primaryFontName(diaryFont);

  await waitForImages(element);
  await waitDocumentFonts();
  if (!loadedFontFaces.has(fontName)) {
    try {
      await document.fonts.load(`400 24px "${fontName}"`);
      await document.fonts.load(`700 24px "${fontName}"`);
    } catch {
      // 시스템 폰트만 있는 경우 무시
    }
    loadedFontFaces.add(fontName);
  }

  const fontCss = await buildEmbeddedFontCss(diaryFont);
  const backgroundColor =
    getComputedStyle(element).backgroundColor ||
    getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() ||
    '#ffffff';

  const blob = await domToBlob(element, {
    scale: options?.scale ?? 2,
    ...(options?.type ? { type: options.type } : {}),
    ...(options?.quality != null ? { quality: options.quality } : {}),
    backgroundColor,
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

  if (!blob) throw new Error('이미지를 만들지 못했어요');
  return blob;
}

/**
 * 상세 화면에 paper가 없을 때(책 PDF 등) —
 * 동일한 diary-detail__paper DOM을 잠시 마운트
 */
export function mountOffscreenDiaryPaper(
  entry: DiaryEntry,
  width = OFFSCREEN_PAPER_WIDTH,
): { paper: HTMLElement; dispose: () => void } {
  const font = diaryFontStack(findFont(entry.fontId).family);
  const visual = getMoodVisual(entry.mood);

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${width}px`,
    'pointer-events:none',
    'z-index:-1',
  ].join(';');

  const paper = document.createElement('div');
  paper.className = 'diary-detail__paper';
  paper.style.setProperty('--diary-font', font);
  paper.style.margin = '0';
  paper.style.width = '100%';
  paper.style.boxSizing = 'border-box';

  const dateline = document.createElement('div');
  dateline.className = 'diary-detail__dateline';
  const dateSpan = document.createElement('span');
  dateSpan.textContent = formatDate(entry.date);
  const moodSpan = document.createElement('span');
  moodSpan.className = 'diary-detail__mood';
  if (visual.icon) {
    const img = document.createElement('img');
    img.className = 'mood-icon';
    img.src = visual.icon;
    img.alt = '';
    img.width = 22;
    img.height = 22;
    img.draggable = false;
    img.style.width = '22px';
    img.style.height = '22px';
    const transform = MOOD_ICON_TRANSFORMS[getStoredMoodPackId()]?.[entry.mood];
    if (transform) img.style.transform = transform;
    moodSpan.appendChild(img);
  } else {
    const emoji = document.createElement('span');
    emoji.className = 'mood-icon mood-icon--emoji';
    emoji.textContent = visual.emoji;
    emoji.style.width = '22px';
    emoji.style.height = '22px';
    moodSpan.appendChild(emoji);
  }
  dateline.append(dateSpan, moodSpan);
  paper.appendChild(dateline);

  if (entry.title) {
    const title = document.createElement('h2');
    title.className = 'diary-detail__title';
    title.textContent = entry.title;
    paper.appendChild(title);
  }

  if (entry.imageUrl) {
    const wrap = document.createElement('div');
    wrap.className = 'diary-detail__image';
    const img = document.createElement('img');
    img.src = entry.imageUrl;
    img.alt = '';
    wrap.appendChild(img);
    paper.appendChild(wrap);
  }

  const section = document.createElement('section');
  section.className = 'diary-detail__section';
  const content = document.createElement('p');
  content.className = 'diary-detail__content';
  content.textContent = entry.content || ' ';
  section.appendChild(content);
  paper.appendChild(section);

  host.appendChild(paper);
  document.body.appendChild(host);

  return {
    paper,
    dispose: () => {
      host.remove();
    },
  };
}

/** paper 요소가 있으면 그대로, 없으면 offscreen으로 캡처 */
export async function captureDiaryEntryPaperBlob(
  entry: DiaryEntry,
  paperElement?: HTMLElement | null,
  options?: CapturePaperOptions,
): Promise<Blob> {
  if (paperElement) {
    return captureDiaryPaperBlob(paperElement, entry.fontId, options);
  }
  const { paper, dispose } = mountOffscreenDiaryPaper(entry);
  try {
    return await captureDiaryPaperBlob(paper, entry.fontId, options);
  } finally {
    dispose();
  }
}

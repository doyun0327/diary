import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveAppLanguage } from '../i18n';
import {
  DEFAULT_FONT_ID,
  DEFAULT_FONT_SIZE_ID,
  fontsForLanguage,
  parseFontSizeId,
  setPreferredFontId,
  setPreferredFontSizeId,
  type FontSizeId,
} from '../utils/fonts';
import { FontSizePicker } from './FontPicker';
import { createId } from '../utils/id';
import { materializeImageSrc } from '../utils/materializeImage';
import { isAssetStickerSrc, toAssetStickerUrl } from '../utils/assetStickers';
import { getEmojiStickerImageUrl } from '../utils/emojiStickerImage';
import { STICKER_CATEGORIES, stickerItemValue, type StickerCategoryId } from '../utils/stickers';
import type { DiaryCanvasState } from '../types/diary';
import AppModal from './AppModal';
import CloseIcon from './CloseIcon';
import './DrawingCanvas.css';

export interface DrawingCanvasHandle {
  toDataURL: () => string | undefined;
  clear: () => void;
  /** 캔버스에 그려 넣음 (AI 교체 등) */
  loadImage: (src: string) => Promise<void>;
  /** 여러 사진 레이어를 나란히 올림 (AI 이전+새 선택 등) */
  loadImages: (srcs: string[]) => Promise<void>;
  /** 수정 가능 사진 레이어로 올림 — 클릭 시 확대·취소·삭제 */
  loadEditableImage: (src: string) => Promise<void>;
  getCanvasState: () => DiaryCanvasState | null;
  loadCanvasState: (state: DiaryCanvasState, fallbackSrc?: string) => Promise<void>;
  prepareExport: () => Promise<void>;
  hasContent: () => boolean;
}

interface DrawingCanvasProps {
  ref?: Ref<DrawingCanvasHandle>;
  /** 이 일기에 쓸 글씨체 (엔트리별) */
  fontId?: string;
  onFontIdChange?: (fontId: string) => void;
  fontSizeId?: FontSizeId;
  onFontSizeChange?: (fontSizeId: FontSizeId) => void;
}

interface PhotoLayer {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspect: number;
  /** radians */
  rotation: number;
}

interface StickerLayer {
  id: string;
  emoji: string;
  imageSrc?: string;
  /** center x */
  x: number;
  /** center y */
  y: number;
  size: number;
  /** radians */
  rotation: number;
}

type ToolMode = 'none' | 'pen' | 'eraser' | 'sticker';
type PenKind = 'ballpoint' | 'gel' | 'brush' | 'marker' | 'highlighter';
type PhotoDragKind = 'move' | 'resize' | 'rotate';
type StickerDragKind = 'move' | 'resize' | 'rotate';

const COLORS = [
  '#2b2b2b',
  '#d94a4a',
  '#e08a3c',
  '#e0b12a',
  '#3aaa6a',
  '#3d8fc9',
  '#7a6bb0',
  '#9a7358',
];

const FONT_CATEGORIES = ['cute', 'neat'] as const;
const PEN_KINDS: PenKind[] = ['ballpoint', 'gel', 'brush', 'marker', 'highlighter'];

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function PenKindIcon({ kind }: { kind: PenKind }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (kind) {
    case 'ballpoint':
      return (
        <svg {...common} strokeWidth="1.6">
          <path d="M14.5 3.5 20.5 9.5" />
          <path d="M13 5 19 11 10 20H4v-6z" />
          <circle cx="6.2" cy="17.8" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'gel':
      return (
        <svg {...common} strokeWidth="1.8">
          <path d="M14.2 3.8 20.2 9.8" />
          <path d="M12.8 5.2 18.8 11.2 9.5 20.5H4.5v-5z" />
          <path d="M5.5 16.5c1.2 0 2.2 1 2.2 2.2" strokeWidth="2.2" />
        </svg>
      );
    case 'brush':
      return (
        <svg {...common} strokeWidth="1.7">
          <path d="M15 3.5c2.2 2.2 4.2 4.5 5.2 6.2-1.4.6-3.2.2-4.6-1.2" />
          <path d="M14.2 5.2 8 14.5c-.6 1-.2 2.2.8 2.8 1 .6 2.2.2 2.8-.8L17.5 9" />
          <path d="M7.2 16.8 4.5 20.5" strokeWidth="2" />
        </svg>
      );
    case 'marker':
      return (
        <svg {...common} strokeWidth="1.7">
          <path d="M14 3.5 20 9.5" />
          <path d="M12.5 5 18.5 11 11 18.5H6.5V14z" />
          <path d="M6.5 14 11 18.5" />
          <path d="M7.2 18.8h4.2" strokeWidth="2.4" strokeLinecap="square" />
        </svg>
      );
    case 'highlighter':
      return (
        <svg {...common} strokeWidth="1.7">
          <path d="M13.5 4 19.5 10" />
          <path d="M12 5.5 18 11.5 12.5 17H7v-5.5z" />
          <path d="M5.5 18.2h8.5" strokeWidth="3.2" opacity="0.45" />
          <path d="M5.5 18.2h8.5" strokeWidth="1.4" />
        </svg>
      );
    default:
      return null;
  }
}

function DockToolIcon({ name }: { name: 'pen' | 'photo' | 'font' | 'sticker' | 'eraser' }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    overflow: 'visible' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'pen':
      return (
        <svg {...common}>
          <path d="M14.2 4.6 19.4 9.8" />
          <path d="M12.7 6.1 17.9 11.3 8.4 20.8H4.2v-4.2z" />
          <path d="M7.4 16.6 11.4 20.6" />
        </svg>
      );
    case 'photo':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <circle cx="9" cy="12" r="2.2" />
          <path d="m21 16-4.2-4.2a1.2 1.2 0 0 0-1.7 0L9 18" />
        </svg>
      );
    case 'font':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <text
            x="3.2"
            y="17.5"
            fontSize="14"
            fontWeight="700"
            fontFamily="Georgia, 'Times New Roman', serif"
          >
            F
          </text>
          <text
            x="12.4"
            y="17.5"
            fontSize="14"
            fontWeight="600"
            fontStyle="italic"
            fontFamily="Georgia, 'Times New Roman', serif"
          >
            f
          </text>
        </svg>
      );
    case 'sticker':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="9" cy="10.2" r="1.05" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10.2" r="1.05" fill="currentColor" stroke="none" />
          <path d="M8.6 14.2c1 .9 2.2 1.4 3.4 1.4s2.4-.5 3.4-1.4" />
        </svg>
      );
    case 'eraser':
      return (
        <svg {...common}>
          <path d="m7 21-4-4 10-10 8 8-4 4H11z" />
          <path d="m13 21 8-8" />
        </svg>
      );
    default:
      return null;
  }
}

const ERASER_SIZES = [
  { id: 's', width: 12 },
  { id: 'm', width: 24 },
  { id: 'l', width: 40 },
] as const;
const DEFAULT_STICKER_SIZE = 48;
const MIN_STICKER_SIZE = 22;
const MAX_STICKER_SIZE = 140;
const MIN_PHOTO_SIZE = 40;
const MAX_UNDO = 30;
const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

function stickerDisplaySrc(value: string): string | null {
  if (isAssetStickerSrc(value)) return toAssetStickerUrl(value);
  return getEmojiStickerImageUrl(value);
}

function layerDisplaySrc(layer: StickerLayer): string | null {
  if (layer.imageSrc) {
    return isAssetStickerSrc(layer.imageSrc) ? toAssetStickerUrl(layer.imageSrc) : layer.imageSrc;
  }
  return getEmojiStickerImageUrl(layer.emoji);
}

function DrawingCanvas({
  ref,
  fontId: fontIdProp,
  onFontIdChange,
  fontSizeId: fontSizeIdProp,
  onFontSizeChange,
}: DrawingCanvasProps) {
  const { t, i18n } = useTranslation();
  const langFonts = fontsForLanguage(resolveAppLanguage(i18n.language));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dockBarRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerPanelRef = useRef<HTMLDivElement>(null);
  const stickerTabsRef = useRef<HTMLDivElement>(null);
  const hueWheelRef = useRef<HTMLDivElement>(null);
  const suppressResizeRef = useRef(false);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasDrawn = useRef(false);
  const undoStack = useRef<HTMLCanvasElement[]>([]);
  const strokeSnapshotPushed = useRef(false);
  const photoImages = useRef<Map<string, HTMLImageElement>>(new Map());
  const photoLayersRef = useRef<PhotoLayer[]>([]);
  const stickerLayersRef = useRef<StickerLayer[]>([]);
  const stickerImages = useRef<Map<string, HTMLImageElement>>(new Map());
  const activePhotoIdRef = useRef<string | null>(null);
  const activeStickerIdRef = useRef<string | null>(null);
  const overlayPointers = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const overlayPinch = useRef<{
    target: 'photo' | 'sticker';
    id: string;
    originPhoto?: PhotoLayer;
    originSticker?: StickerLayer;
    startDist: number;
    startMidX: number;
    startMidY: number;
  } | null>(null);
  const photoDrag = useRef<{
    kind: PhotoDragKind;
    id: string;
    startX: number;
    startY: number;
    origin: PhotoLayer;
    startAngle: number;
    /** 이미 선택된 상태에서 짧게 탭하면 ✓와 동일하게 확정 */
    wasAlreadyActive: boolean;
  } | null>(null);
  const stickerDrag = useRef<{
    kind: StickerDragKind;
    id: string;
    startX: number;
    startY: number;
    origin: StickerLayer;
    startAngle: number;
  } | null>(null);

  const [color, setColor] = useState(COLORS[0]);
  const [customColor, setCustomColor] = useState('#ef7a8a');
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [pickerHue, setPickerHue] = useState(350);
  const [pickerLight, setPickerLight] = useState(62);
  const [mode, setMode] = useState<ToolMode>('none');
  const [penKind, setPenKind] = useState<PenKind>('gel');
  const [stickerOpen, setStickerOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [stickerCategoryId, setStickerCategoryId] =
    useState<StickerCategoryId>('face');
  const [selectedSticker, setSelectedSticker] = useState<string>(() =>
    stickerItemValue(STICKER_CATEGORIES[0].items[0]),
  );
  const [eraserSizeId, setEraserSizeId] =
    useState<(typeof ERASER_SIZES)[number]['id']>('m');

  useEffect(() => {
    if (!colorsOpen || mode !== 'pen' || fontOpen) {
      setCustomPickerOpen(false);
    }
  }, [colorsOpen, mode, fontOpen]);

  useEffect(() => {
    if (!stickerOpen) return;
    const panel = stickerPanelRef.current;
    if (!panel) return;
    const frame = window.requestAnimationFrame(() => {
      panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stickerOpen]);

  useEffect(() => {
    if (!stickerOpen) return;
    const tabs = stickerTabsRef.current;
    if (!tabs) return;
    const active = tabs.querySelector<HTMLElement>('.drawing__sticker-tab.active');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [stickerCategoryId, stickerOpen]);

  /** 도구줄(dock-bar) 높이만큼 그리기 영역·저장에서 제외 */
  useEffect(() => {
    const wrap = wrapRef.current;
    const dockBar = dockBarRef.current;
    if (!wrap || !dockBar) return;

    const syncDockReserve = () => {
      const barH = dockBar.getBoundingClientRect().height;
      const reserve = Math.ceil(barH + 16);
      wrap.style.setProperty('--drawing-dock-reserve', `${reserve}px`);
    };

    syncDockReserve();
    const ro = new ResizeObserver(syncDockReserve);
    ro.observe(dockBar);
    window.addEventListener('resize', syncDockReserve);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncDockReserve);
    };
  }, []);

  const applyPickerColor = (hue: number, light: number) => {
    const next = hslToHex(hue, 58, light);
    setPickerHue(hue);
    setPickerLight(light);
    setCustomColor(next);
    setColor(next);
  };

  const handleHueWheelPointer = (e: PointerEvent<HTMLDivElement>) => {
    const el = hueWheelRef.current;
    if (!el) return;
    if (e.type === 'pointerdown') {
      el.setPointerCapture(e.pointerId);
    }
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    let hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (hue < 0) hue += 360;
    hue = Math.round(hue) % 360;
    applyPickerColor(hue, pickerLight);
  };
  const [internalFontId, setInternalFontId] = useState(DEFAULT_FONT_ID);
  const fontId = fontIdProp ?? internalFontId;
  const [internalFontSizeId, setInternalFontSizeId] = useState(DEFAULT_FONT_SIZE_ID);
  const fontSizeId = parseFontSizeId(fontSizeIdProp ?? internalFontSizeId);
  const [photoLayers, setPhotoLayers] = useState<PhotoLayer[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  photoLayersRef.current = photoLayers;
  stickerLayersRef.current = stickerLayers;
  activePhotoIdRef.current = activePhotoId;
  activeStickerIdRef.current = activeStickerId;
  const [canUndo, setCanUndo] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const eraserWidth =
    ERASER_SIZES.find((s) => s.id === eraserSizeId)?.width ?? 24;

  const selectFont = (id: string) => {
    onFontIdChange?.(id);
    if (fontIdProp === undefined) setInternalFontId(id);
    setPreferredFontId(id);
  };

  const selectFontSize = (id: FontSizeId) => {
    onFontSizeChange?.(id);
    if (fontSizeIdProp === undefined) setInternalFontSizeId(id);
    setPreferredFontSizeId(id);
  };

  /** 잉크 레이어만 비움 (아래 사진 오버레이는 유지, 배경은 wrap) */
  const clearInk = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  const ensureCanvasLayout = async (): Promise<DOMRect> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error(t('canvas.err.noCanvas'));
    let lastW = 0;
    let stable = 0;
    for (let i = 0; i < 60; i++) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        if (Math.abs(rect.width - lastW) < 0.5) stable += 1;
        else {
          stable = 0;
          lastW = rect.width;
        }
        if (stable >= 2) {
          const dpr = window.devicePixelRatio || 1;
          const width = Math.round(rect.width * dpr);
          const height = Math.round(rect.height * dpr);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          }
          return rect;
        }
      }
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
    return canvas.getBoundingClientRect();
  };

  const loadHtmlImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(t('canvas.err.imageLoad')));
      el.src = src;
    });

  const resolveLayerSrc = async (src: string) => {
    try {
      return await materializeImageSrc(src, { fallbackToOriginal: true });
    } catch {
      return src.trim();
    }
  };

  const rematerializePhotosForExport = async () => {
    const layers = photoLayersRef.current;
    for (const layer of layers) {
      if (!layer.src || layer.src.startsWith('data:') || layer.src.startsWith('blob:')) {
        continue;
      }
      try {
        const safe = await materializeImageSrc(layer.src);
        const img = await loadHtmlImage(safe);
        photoImages.current.set(layer.id, img);
        layer.src = safe;
      } catch (err) {
        console.warn('[canvas] rematerialize photo failed', layer.id, err);
      }
    }
    setPhotoLayers([...photoLayersRef.current]);
  };

  const clearUndoStack = () => {
    undoStack.current = [];
    setCanUndo(false);
  };

  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 1 || canvas.height < 1) return;
    const snap = document.createElement('canvas');
    snap.width = canvas.width;
    snap.height = canvas.height;
    const sctx = snap.getContext('2d');
    if (!sctx) return;
    sctx.drawImage(canvas, 0, 0);
    undoStack.current.push(snap);
    while (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    setCanUndo(true);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const snap = undoStack.current.pop();
    if (!canvas || !snap) {
      setCanUndo(false);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(snap, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    setCanUndo(undoStack.current.length > 0);
  };

  const exportDataUrl = (): string | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const photos = photoLayersRef.current;
    const stickers = stickerLayersRef.current;
    if (!hasDrawn.current && photos.length === 0 && stickers.length === 0) {
      return undefined;
    }

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return undefined;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      photos.forEach((layer) => bakePhotoToCanvas(layer, ctx));
      ctx.drawImage(canvas, 0, 0);
      stickers.forEach((layer) => bakeStickerToCanvas(layer, ctx));

      return exportCanvas.toDataURL('image/png');
    } catch (err) {
      console.error('[canvas] toDataURL failed', err);
      throw new Error(
        err instanceof DOMException && err.name === 'SecurityError'
          ? t('canvas.err.tainted')
          : t('canvas.err.export'),
      );
    }
  };

  const bakePhotoToCanvas = (layer: PhotoLayer, targetCtx?: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    const img = photoImages.current.get(layer.id);
    if (!canvas || !img) return;
    const ctx = targetCtx ?? canvas.getContext('2d');
    if (!ctx) return;

    const dpr = targetCtx ? (canvas.width / canvas.getBoundingClientRect().width || 1) : 1;
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;

    ctx.save();
    if (targetCtx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.translate(cx, cy);
    ctx.rotate(layer.rotation);
    ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
    ctx.restore();
    hasDrawn.current = true;
  };

  const ensureStickerImage = (src: string): Promise<HTMLImageElement> => {
    const cached = stickerImages.current.get(src);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        stickerImages.current.set(src, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(t('canvas.err.imageLoad')));
      img.src = isAssetStickerSrc(src) ? toAssetStickerUrl(src) : src;
    });
  };

  const bakeStickerToCanvas = (layer: StickerLayer, targetCtx?: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = targetCtx ?? canvas.getContext('2d');
    if (!ctx) return;

    const dpr = targetCtx ? (canvas.width / canvas.getBoundingClientRect().width || 1) : 1;
    if (layer.imageSrc) {
      const img = stickerImages.current.get(layer.imageSrc);
      if (!img) return;
      const half = layer.size / 2;
      ctx.save();
      if (targetCtx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.rotation);
      ctx.drawImage(img, -half, -half, layer.size, layer.size);
      ctx.restore();
      hasDrawn.current = true;
      return;
    }

    if (targetCtx) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.rotation);
      ctx.font = `${layer.size}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layer.emoji, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.rotation);
      ctx.font = `${layer.size}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layer.emoji, 0, 0);
      ctx.restore();
    }
    hasDrawn.current = true;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      if (suppressResizeRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width === width && canvas.height === height) return;

      let snapshot: HTMLCanvasElement | null = null;
      if (hasDrawn.current && canvas.width > 0 && canvas.height > 0) {
        snapshot = document.createElement('canvas');
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      clearInk();
      if (snapshot) {
        ctx.drawImage(snapshot, 0, 0, rect.width, rect.height);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const beginOverlayPinch = () => {
    const pts = [...overlayPointers.current.values()];
    if (pts.length < 2) return;
    const startDist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
    const startMidX = (pts[0].x + pts[1].x) / 2;
    const startMidY = (pts[0].y + pts[1].y) / 2;
    const photoId = activePhotoIdRef.current;
    const stickerId = activeStickerIdRef.current;
    if (photoId) {
      const origin = photoLayersRef.current.find((l) => l.id === photoId);
      if (!origin) return;
      photoDrag.current = null;
      overlayPinch.current = {
        target: 'photo',
        id: photoId,
        originPhoto: { ...origin },
        startDist,
        startMidX,
        startMidY,
      };
      return;
    }
    if (stickerId) {
      const origin = stickerLayersRef.current.find((l) => l.id === stickerId);
      if (!origin) return;
      stickerDrag.current = null;
      overlayPinch.current = {
        target: 'sticker',
        id: stickerId,
        originSticker: { ...origin },
        startDist,
        startMidX,
        startMidY,
      };
    }
  };

  const resumeOverlayMove = () => {
    overlayPinch.current = null;
    const remaining = overlayPointers.current.entries().next().value as
      | [number, { x: number; y: number }]
      | undefined;
    if (!remaining) {
      photoDrag.current = null;
      stickerDrag.current = null;
      return;
    }
    const [, pos] = remaining;
    const photoId = activePhotoIdRef.current;
    const stickerId = activeStickerIdRef.current;
    if (photoId) {
      const origin = photoLayersRef.current.find((l) => l.id === photoId);
      if (origin) {
        photoDrag.current = {
          kind: 'move',
          id: photoId,
          startX: pos.x,
          startY: pos.y,
          origin: { ...origin },
          startAngle: 0,
          wasAlreadyActive: true,
        };
      }
      return;
    }
    if (stickerId) {
      const origin = stickerLayersRef.current.find((l) => l.id === stickerId);
      if (origin) {
        stickerDrag.current = {
          kind: 'move',
          id: stickerId,
          startX: pos.x,
          startY: pos.y,
          origin: { ...origin },
          startAngle: 0,
        };
      }
    }
  };

  useEffect(() => {
    const onMove = (e: globalThis.PointerEvent) => {
      if (overlayPointers.current.has(e.pointerId)) {
        overlayPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      const pinch = overlayPinch.current;
      if (pinch) {
        const pts = [...overlayPointers.current.values()];
        if (pts.length < 2) return;
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const scale = dist / pinch.startDist;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const wrap = wrapRef.current?.getBoundingClientRect();
        if (!wrap) return;
        const midLocalX = midX - wrap.left;
        const midLocalY = midY - wrap.top;
        const startMidLocalX = pinch.startMidX - wrap.left;
        const startMidLocalY = pinch.startMidY - wrap.top;

        if (pinch.target === 'photo' && pinch.originPhoto) {
          const origin = pinch.originPhoto;
          const maxW = Math.max(MIN_PHOTO_SIZE, wrap.width * 3);
          const newWidth = Math.min(
            maxW,
            Math.max(MIN_PHOTO_SIZE, origin.width * scale),
          );
          const s = newWidth / origin.width;
          const newHeight = newWidth / origin.aspect;
          const ocx = origin.x + origin.width / 2;
          const ocy = origin.y + origin.height / 2;
          const newCx = midLocalX + (ocx - startMidLocalX) * s;
          const newCy = midLocalY + (ocy - startMidLocalY) * s;
          setPhotoLayers((prev) =>
            prev.map((layer) =>
              layer.id === pinch.id
                ? {
                    ...layer,
                    width: newWidth,
                    height: newHeight,
                    x: newCx - newWidth / 2,
                    y: newCy - newHeight / 2,
                  }
                : layer,
            ),
          );
        }

        if (pinch.target === 'sticker' && pinch.originSticker) {
          const origin = pinch.originSticker;
          const next = Math.round(
            Math.min(
              MAX_STICKER_SIZE,
              Math.max(MIN_STICKER_SIZE, origin.size * scale),
            ),
          );
          const s = next / origin.size;
          const newX = midLocalX + (origin.x - startMidLocalX) * s;
          const newY = midLocalY + (origin.y - startMidLocalY) * s;
          setStickerLayers((prev) =>
            prev.map((layer) =>
              layer.id === pinch.id
                ? { ...layer, size: next, x: newX, y: newY }
                : layer,
            ),
          );
        }
        return;
      }

      if (photoDrag.current) {
        const { kind, id, startX, startY, origin, startAngle } = photoDrag.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        setPhotoLayers((prev) =>
          prev.map((layer) => {
            if (layer.id !== id) return layer;
            if (kind === 'move') {
              return { ...layer, x: origin.x + dx, y: origin.y + dy };
            }
            if (kind === 'resize') {
              const wrap = wrapRef.current?.getBoundingClientRect();
              if (!wrap) return layer;
              const cx = wrap.left + origin.x + origin.width / 2;
              const cy = wrap.top + origin.y + origin.height / 2;
              const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
              const originDist = Math.max(
                1,
                Math.hypot(startX - cx, startY - cy),
              );
              const nextScale = dist / originDist;
              const newWidth = Math.max(MIN_PHOTO_SIZE, origin.width * nextScale);
              const newHeight = newWidth / origin.aspect;
              const cxLocal = origin.x + origin.width / 2;
              const cyLocal = origin.y + origin.height / 2;
              return {
                ...layer,
                width: newWidth,
                height: newHeight,
                x: cxLocal - newWidth / 2,
                y: cyLocal - newHeight / 2,
              };
            }
            const wrap = wrapRef.current?.getBoundingClientRect();
            if (!wrap) return layer;
            const cx = wrap.left + origin.x + origin.width / 2;
            const cy = wrap.top + origin.y + origin.height / 2;
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
            return { ...layer, rotation: origin.rotation + (angle - startAngle) };
          }),
        );
        return;
      }

      if (!stickerDrag.current) return;
      const { kind, id, startX, startY, origin, startAngle } = stickerDrag.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      setStickerLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== id) return layer;
          if (kind === 'move') {
            return { ...layer, x: origin.x + dx, y: origin.y + dy };
          }
          if (kind === 'resize') {
            const wrap = wrapRef.current?.getBoundingClientRect();
            if (!wrap) return layer;
            const cx = wrap.left + origin.x;
            const cy = wrap.top + origin.y;
            const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
            const originDist = Math.max(1, Math.hypot(startX - cx, startY - cy));
            const next = Math.round(
              Math.min(
                MAX_STICKER_SIZE,
                Math.max(MIN_STICKER_SIZE, origin.size * (dist / originDist)),
              ),
            );
            return { ...layer, size: next };
          }
          const wrap = wrapRef.current?.getBoundingClientRect();
          if (!wrap) return layer;
          const cx = wrap.left + origin.x;
          const cy = wrap.top + origin.y;
          const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
          return { ...layer, rotation: origin.rotation + (angle - startAngle) };
        }),
      );
    };

    const onUp = (e: globalThis.PointerEvent) => {
      overlayPointers.current.delete(e.pointerId);
      if (overlayPinch.current) {
        if (overlayPointers.current.size >= 2) return;
        resumeOverlayMove();
        return;
      }
      if (overlayPointers.current.size > 0) return;

      const drag = photoDrag.current;
      if (
        drag &&
        drag.kind === 'move' &&
        drag.wasAlreadyActive &&
        Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 12
      ) {
        // 선택된 사진을 짧게 다시 탭 → ✓와 동일 (펜은 직접 눌러야 선택)
        setActivePhotoId(null);
        setMode('none');
        setColorsOpen(false);
        setFontOpen(false);
        setStickerOpen(false);
      }

      photoDrag.current = null;
      stickerDrag.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    toDataURL: exportDataUrl,
    prepareExport: rematerializePhotosForExport,
    clear: () => {
      clearUndoStack();
      clearInk();
      hasDrawn.current = false;
      photoImages.current.clear();
      setPhotoLayers([]);
      setActivePhotoId(null);
      setStickerLayers([]);
      setActiveStickerId(null);
    },
    hasContent: () =>
      hasDrawn.current ||
      photoLayersRef.current.length > 0 ||
      stickerLayersRef.current.length > 0,
    getCanvasState: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const photos = photoLayersRef.current;
      const stickers = stickerLayersRef.current;
      const hasInk = hasDrawn.current;
      if (photos.length === 0 && stickers.length === 0 && !hasInk) {
        return null;
      }
      const vw = Math.max(1, rect.width);
      const vh = Math.max(1, rect.height);
      let inkUrl: string | undefined;
      if (hasInk && canvas.width > 1 && canvas.height > 1) {
        try {
          inkUrl = canvas.toDataURL('image/png');
        } catch {
          inkUrl = undefined;
        }
      }
      return {
        viewWidth: vw,
        viewHeight: vh,
        normalized: true,
        photos: photos.map((p) => ({
          ...p,
          x: p.x / vw,
          y: p.y / vh,
          width: p.width / vw,
          height: p.height / vh,
        })),
        stickers: stickers.map((s) => ({
          id: s.id,
          emoji: s.emoji,
          ...(s.imageSrc ? { imageSrc: s.imageSrc } : {}),
          x: s.x / vw,
          y: s.y / vh,
          size: s.size / vw,
          rotation: s.rotation,
        })),
        inkUrl,
      };
    },
    loadCanvasState: async (state: DiaryCanvasState, fallbackSrc?: string) => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error(t('canvas.err.noCanvas'));
      suppressResizeRef.current = true;
      try {
        clearUndoStack();
        clearInk();
        hasDrawn.current = false;
        photoImages.current.clear();
        setPhotoLayers([]);
        setActivePhotoId(null);
        setStickerLayers([]);
        setActiveStickerId(null);

        const rect = await ensureCanvasLayout();
        const dpr = window.devicePixelRatio || 1;
        const sx = state.viewWidth > 1 ? rect.width / state.viewWidth : 1;
        const sy = state.viewHeight > 1 ? rect.height / state.viewHeight : 1;
        const normalized =
          state.normalized === true ||
          ((state.photos?.[0]?.width ?? 2) <= 1.5 &&
            (state.photos?.[0]?.height ?? 2) <= 1.5);

        if (state.inkUrl?.trim()) {
          try {
            const safeInk = await resolveLayerSrc(state.inkUrl.trim());
            const img = await loadHtmlImage(safeInk);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error(t('canvas.err.noContext'));
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            hasDrawn.current = true;
          } catch (err) {
            console.warn('[canvas] ink restore failed', err);
          }
        }

        const nextPhotos: typeof photoLayers = [];
        for (const p of state.photos ?? []) {
          if (!p?.src?.trim()) continue;
          try {
            const safeSrc = await resolveLayerSrc(p.src.trim());
            const img = await loadHtmlImage(safeSrc);
            const id = p.id || createId();
            photoImages.current.set(id, img);
            nextPhotos.push({
              id,
              src: safeSrc,
              x: normalized ? p.x * rect.width : p.x * sx,
              y: normalized ? p.y * rect.height : p.y * sy,
              width: normalized ? p.width * rect.width : p.width * sx,
              height: normalized ? p.height * rect.height : p.height * sy,
              aspect: p.aspect || img.width / Math.max(1, img.height),
              rotation: p.rotation || 0,
            });
          } catch (err) {
            console.warn('[canvas] photo restore failed', err);
          }
        }

        if (
          nextPhotos.length === 0 &&
          fallbackSrc?.trim() &&
          !hasDrawn.current &&
          !(state.stickers?.length)
        ) {
          try {
            const safeSrc = await resolveLayerSrc(fallbackSrc.trim());
            const img = await loadHtmlImage(safeSrc);
            const id = createId();
            const aspect = img.width / Math.max(1, img.height);
            let width = rect.width * 0.85;
            let height = width / aspect;
            if (height > rect.height * 0.85) {
              height = rect.height * 0.85;
              width = height * aspect;
            }
            photoImages.current.set(id, img);
            nextPhotos.push({
              id,
              src: safeSrc,
              x: (rect.width - width) / 2,
              y: (rect.height - height) / 2,
              width,
              height,
              aspect,
              rotation: 0,
            });
          } catch (err) {
            console.warn('[canvas] fallback photo failed', err);
          }
        }

        setPhotoLayers(nextPhotos);
        const nextStickers: StickerLayer[] = [];
        for (const s of state.stickers ?? []) {
          if (!s?.emoji && !s?.imageSrc) continue;
          const imageSrc = s.imageSrc ?? getEmojiStickerImageUrl(s.emoji) ?? undefined;
          if (imageSrc) {
            try {
              await ensureStickerImage(imageSrc);
            } catch (err) {
              console.warn('[canvas] sticker image failed', err);
              continue;
            }
          }
          nextStickers.push({
            id: s.id || createId(),
            emoji: imageSrc ? '' : (s.emoji ?? ''),
            imageSrc,
            x: normalized ? s.x * rect.width : s.x * sx,
            y: normalized ? s.y * rect.height : s.y * sy,
            size: normalized ? s.size * rect.width : s.size * ((sx + sy) / 2),
            rotation: s.rotation || 0,
          });
        }
        setStickerLayers(nextStickers);
        setMode('none');
        setColorsOpen(false);
        setFontOpen(false);
        setStickerOpen(false);

        if (
          nextPhotos.length === 0 &&
          !(state.stickers?.length) &&
          !hasDrawn.current
        ) {
          throw new Error(t('canvas.err.imageLoad'));
        }
      } finally {
        suppressResizeRef.current = false;
      }
    },
    loadImage: async (src: string) => {
      clearUndoStack();
      clearInk();
      hasDrawn.current = false;
      photoImages.current.clear();
      setPhotoLayers([]);
      setActivePhotoId(null);
      setStickerLayers([]);
      setActiveStickerId(null);
      await ensureCanvasLayout();
      const safeSrc = await resolveLayerSrc(src);
      await addPhotoLayerAsync(safeSrc, 0.85, true);
    },
    loadImages: async (srcs: string[]) => {
      if (srcs.length === 0) return;
      clearUndoStack();
      clearInk();
      hasDrawn.current = false;
      photoImages.current.clear();
      setPhotoLayers([]);
      setActivePhotoId(null);
      setStickerLayers([]);
      setActiveStickerId(null);
      await ensureCanvasLayout();

      const canvas = canvasRef.current;
      if (!canvas) throw new Error(t('canvas.err.noCanvas'));
      const rect = canvas.getBoundingClientRect();
      const n = srcs.length;
      const fit = n > 1 ? 0.38 : 0.85;
      const layers: PhotoLayer[] = [];

      for (let i = 0; i < srcs.length; i++) {
        const safeSrc = await resolveLayerSrc(srcs[i]);
        const img = await loadHtmlImage(safeSrc);
        const aspect = img.width / Math.max(1, img.height);
        let width = rect.width * fit;
        let height = width / aspect;
        if (height > rect.height * fit) {
          height = rect.height * fit;
          width = height * aspect;
        }
        let x: number;
        const y = (rect.height - height) / 2;
        if (n > 1) {
          const slotW = rect.width / n;
          x = slotW * i + (slotW - width) / 2;
        } else {
          x = (rect.width - width) / 2;
        }
        const id = createId();
        photoImages.current.set(id, img);
        layers.push({ id, src: safeSrc, x, y, width, height, aspect, rotation: 0 });
      }

      setPhotoLayers(layers);
      setActivePhotoId(null);
      setMode('none');
      setColorsOpen(false);
      setFontOpen(false);
      setStickerOpen(false);
    },
    loadEditableImage: async (src: string) => {
      clearUndoStack();
      clearInk();
      hasDrawn.current = false;
      photoImages.current.clear();
      setPhotoLayers([]);
      setActivePhotoId(null);
      setStickerLayers([]);
      setActiveStickerId(null);
      await ensureCanvasLayout();
      const safeSrc = await resolveLayerSrc(src);
      await addPhotoLayerAsync(safeSrc, 0.85, false);
    },
  }));

  /** ✓ — 선택만 해제. 펜은 도구에서 직접 눌러야 선택됨 */
  const confirmActivePhoto = () => {
    setActivePhotoId(null);
    setMode('none');
    setColorsOpen(false);
    setFontOpen(false);
    setStickerOpen(false);
  };

  const confirmActiveSticker = () => {
    setActiveStickerId(null);
    // ✓ 후엔 스티커 배치 종료 — 펜은 직접 눌러야 선택
    setMode('none');
    setStickerOpen(false);
    setColorsOpen(false);
  };

  const removeActivePhoto = () => {
    if (!activePhotoId) return;
    photoImages.current.delete(activePhotoId);
    setPhotoLayers((prev) => prev.filter((l) => l.id !== activePhotoId));
    setActivePhotoId(null);
  };

  const removeActiveSticker = () => {
    if (!activeStickerId) return;
    setStickerLayers((prev) => prev.filter((l) => l.id !== activeStickerId));
    setActiveStickerId(null);
    setMode('none');
    setStickerOpen(false);
    setColorsOpen(false);
  };

  const confirmActiveOverlay = () => {
    setActivePhotoId(null);
    setActiveStickerId(null);
  };

  const switchTool = (next: ToolMode, openColors: boolean) => {
    // 사진 편집 중 펜/지우개 선택 = ✓와 동일하게 확정 후 그리기
    if (activePhotoIdRef.current && (next === 'pen' || next === 'eraser')) {
      setActivePhotoId(null);
    } else {
      confirmActiveOverlay();
    }
    setMode(next);
    setStickerOpen(false);
    setFontOpen(false);
    setColorsOpen(openColors);
  };

  const selectPen = () => {
    if (mode === 'pen' && !fontOpen) {
      switchTool('none', false);
      return;
    }
    switchTool('pen', true);
  };
  const selectEraser = () => switchTool('eraser', false);

  useEffect(() => {
    if (mode !== 'pen' && mode !== 'eraser') return;
    const onPointerDown = (e: globalThis.PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      switchTool('none', false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [mode]);

  const toggleFontPanel = () => {
    confirmActiveOverlay();
    setFontOpen((open) => {
      const next = !open;
      if (next) {
        setStickerOpen(false);
        setColorsOpen(false);
      }
      return next;
    });
  };

  const toggleStickerPanel = () => {
    confirmActiveOverlay();
    setStickerOpen((open) => {
      const next = !open;
      if (next) {
        setMode('sticker');
        setColorsOpen(false);
        setFontOpen(false);
      } else {
        setMode('none');
        setColorsOpen(false);
      }
      return next;
    });
  };

  const pickSticker = (emoji: string) => {
    setSelectedSticker(emoji);
    setMode('sticker');
    setStickerOpen(false);
    setFontOpen(false);
  };

  const pickFont = (id: string) => {
    selectFont(id);
    setFontOpen(false);
  };

  const addPhotoLayerAsync = (
    dataUrl: string,
    fit = 0.55,
    select = true,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error(t('canvas.err.noCanvas')));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        const aspect = img.width / Math.max(1, img.height);
        let width = rect.width * fit;
        let height = width / aspect;
        if (height > rect.height * fit) {
          height = rect.height * fit;
          width = height * aspect;
        }

        const id = createId();
        const layer: PhotoLayer = {
          id,
          src: dataUrl,
          x: (rect.width - width) / 2,
          y: (rect.height - height) / 2,
          width,
          height,
          aspect,
          rotation: 0,
        };

        confirmActiveOverlay();
        photoImages.current.set(id, img);
        setPhotoLayers((prev) => [...prev, layer]);
        setActivePhotoId(select ? id : null);
        setMode('none');
        setColorsOpen(false);
        setFontOpen(false);
        setStickerOpen(false);
        resolve();
      };
      img.onerror = () => reject(new Error(t('canvas.err.imageLoad')));
      img.src = dataUrl;
    });

  const addPhotoLayer = (dataUrl: string) => {
    void addPhotoLayerAsync(dataUrl).catch(() => {
      alert(t('canvas.err.imageLoad'));
    });
  };

  const placeStickerLayer = (value: string, x: number, y: number) => {
    confirmActiveOverlay();
    const imageSrc = isAssetStickerSrc(value)
      ? value
      : (getEmojiStickerImageUrl(value) ?? undefined);

    const addLayer = () => {
      const id = createId();
      const layer: StickerLayer = {
        id,
        emoji: imageSrc ? '' : value,
        imageSrc,
        x,
        y,
        size: DEFAULT_STICKER_SIZE,
        rotation: 0,
      };
      setStickerLayers((prev) => [...prev, layer]);
      setActiveStickerId(id);
    };

    if (imageSrc) {
      void ensureStickerImage(imageSrc)
        .then(addLayer)
        .catch(() => {
          alert(t('canvas.err.imageLoad'));
        });
      return;
    }

    addLayer();
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('canvas.alert.imageOnly'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => addPhotoLayer(reader.result as string);
    reader.readAsDataURL(file);
  };

  const startPhotoDrag = (
    e: PointerEvent,
    kind: PhotoDragKind,
    layer: PhotoLayer,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (activeStickerId) setActiveStickerId(null);
    const wasAlreadyActive = activePhotoIdRef.current === layer.id;
    setActivePhotoId(layer.id);
    activePhotoIdRef.current = layer.id;
    activeStickerIdRef.current = null;

    const live = photoLayersRef.current.find((l) => l.id === layer.id) ?? layer;
    const wrap = wrapRef.current?.getBoundingClientRect();
    const cx = (wrap?.left ?? 0) + live.x + live.width / 2;
    const cy = (wrap?.top ?? 0) + live.y + live.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);

    if (kind === 'move') {
      overlayPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (overlayPointers.current.size >= 2) {
        beginOverlayPinch();
        return;
      }
    } else {
      overlayPointers.current.clear();
      overlayPinch.current = null;
    }

    photoDrag.current = {
      kind,
      id: live.id,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...live },
      startAngle,
      wasAlreadyActive,
    };
  };

  const startStickerDrag = (
    e: PointerEvent,
    kind: StickerDragKind,
    layer: StickerLayer,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (activePhotoId) setActivePhotoId(null);
    setActiveStickerId(layer.id);
    activeStickerIdRef.current = layer.id;
    activePhotoIdRef.current = null;

    const live = stickerLayersRef.current.find((l) => l.id === layer.id) ?? layer;
    const wrap = wrapRef.current?.getBoundingClientRect();
    const cx = (wrap?.left ?? 0) + live.x;
    const cy = (wrap?.top ?? 0) + live.y;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);

    if (kind === 'move') {
      overlayPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (overlayPointers.current.size >= 2) {
        beginOverlayPinch();
        return;
      }
    } else {
      overlayPointers.current.clear();
      overlayPinch.current = null;
    }

    stickerDrag.current = {
      kind,
      id: live.id,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...live },
      startAngle,
    };
  };

  const handleWrapPinchCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    if (overlayPointers.current.has(e.pointerId)) return;
    if (overlayPointers.current.size === 0) return;
    if (!activePhotoIdRef.current && !activeStickerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    overlayPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginOverlayPinch();
  };

  /** 사진 밖(캔버스 빈 곳·도구 바깥)을 누르면 ✓와 동일 */
  const handleWrapBackgroundDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!activePhotoIdRef.current && !activeStickerIdRef.current) return;
    const el = e.target as HTMLElement | null;
    if (
      el?.closest(
        '.drawing__photo, .drawing__sticker-layer, .drawing__dock, button, .drawing__photo-handle, .drawing__sticker-rotate',
      )
    ) {
      return;
    }
    if (activePhotoIdRef.current) {
      confirmActivePhoto();
      return;
    }
    setActiveStickerId(null);
  };

  const getPos = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const strokeStyleForPen = (): { width: number; alpha: number; composite?: GlobalCompositeOperation } => {
    switch (penKind) {
      case 'ballpoint':
        return { width: 1.6, alpha: 1 };
      case 'gel':
        return { width: 3, alpha: 1 };
      case 'brush':
        return { width: 8, alpha: 0.85 };
      case 'marker':
        return { width: 7, alpha: 0.95 };
      case 'highlighter':
        return { width: 16, alpha: 0.32 };
      default:
        return { width: 3, alpha: 1 };
    }
  };

  const handleDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (mode === 'sticker') {
      e.preventDefault();
      // 편집 중이면 선택만 해제 (새 스티커 붙이지 않음)
      if (activeStickerId) {
        setActiveStickerId(null);
        return;
      }
      const pos = getPos(e);
      placeStickerLayer(selectedSticker, pos.x, pos.y);
      return;
    }

    confirmActiveOverlay();
    if (mode === 'none') return;

    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokeSnapshotPushed.current = false;
    lastPos.current = getPos(e);
  };

  const handleMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (mode === 'sticker' || !drawing.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;

    if (!strokeSnapshotPushed.current) {
      pushUndoSnapshot();
      strokeSnapshotPushed.current = true;
    }

    const pos = getPos(e);
    const last = lastPos.current;
    const dist = Math.hypot(pos.x - last.x, pos.y - last.y);

    ctx.save();
    if (mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = eraserWidth;
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else {
      const pen = strokeStyleForPen();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.globalAlpha = pen.alpha;
      ctx.lineCap = penKind === 'marker' ? 'square' : 'round';
      ctx.lineJoin = 'round';
      if (penKind === 'brush') {
        // 느리면 굵게, 빠르면 얇게
        ctx.lineWidth = Math.max(2.5, Math.min(14, 14 - dist * 0.55));
      } else {
        ctx.lineWidth = pen.width;
      }
    }

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.restore();

    lastPos.current = pos;
    hasDrawn.current = true;
  };

  const handleUp = () => {
    drawing.current = false;
    strokeSnapshotPushed.current = false;
  };

  const applyClearAll = () => {
    clearUndoStack();
    clearInk();
    hasDrawn.current = false;
    photoImages.current.clear();
    setPhotoLayers([]);
    setActivePhotoId(null);
    setStickerLayers([]);
    setActiveStickerId(null);
    setClearConfirmOpen(false);
  };

  const editingOverlay = Boolean(activePhotoId || activeStickerId);
  const allowPageScroll =
    mode === 'none' && !fontOpen && !stickerOpen && !editingOverlay;
  /** 선택 도구·사진 편집 중엔 아래 사진 레이어가 터치를 받음 */
  const canvasPassThrough = mode === 'none' || Boolean(activePhotoId);

  const canvasClass = [
    'drawing__canvas',
    allowPageScroll ? 'drawing__canvas--idle' : '',
    canvasPassThrough ? 'drawing__canvas--pass' : '',
    mode === 'eraser' ? 'drawing__canvas--eraser' : '',
    mode === 'sticker' ? 'drawing__canvas--sticker' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
      <div className="drawing" data-no-swipe={!allowPageScroll || undefined} ref={rootRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="drawing__file-input"
        onChange={handlePhotoChange}
      />

      <div
        className={`drawing__canvas-wrap${allowPageScroll ? ' drawing__canvas-wrap--scroll' : ''}`}
        ref={wrapRef}
        onPointerDownCapture={handleWrapPinchCapture}
        onPointerDown={handleWrapBackgroundDown}
      >
        <div className="drawing__canvas-stage">
        <div className="drawing__photo-layers">
          {photoLayers.map((layer) => {
            const isActive = activePhotoId === layer.id;
            return (
              <div
                key={layer.id}
                className={`drawing__photo ${isActive ? 'active' : ''}`}
                style={{
                  left: layer.x,
                  top: layer.y,
                  width: layer.width,
                  height: layer.height,
                  transform: `rotate(${layer.rotation}rad)`,
                }}
                onPointerDown={(e) => startPhotoDrag(e, 'move', layer)}
              >
                <img src={layer.src} alt="" draggable={false} />
                {isActive && (
                  <>
                    <button
                      type="button"
                      className="drawing__photo-remove"
                      aria-label={t('canvas.removeOverlay')}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeActivePhoto();
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                        <path
                          d="M2 2l8 8M10 2L2 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="drawing__photo-confirm"
                      aria-label={t('canvas.photoConfirm')}
                      title={t('canvas.photoConfirm')}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmActivePhoto();
                      }}
                    >
                      ✓
                    </button>
                    <div
                      className="drawing__sticker-rotate"
                      title={t('canvas.stickerRotate')}
                      onPointerDown={(e) => startPhotoDrag(e, 'rotate', layer)}
                    />
                    <div
                      className="drawing__photo-handle"
                      onPointerDown={(e) => startPhotoDrag(e, 'resize', layer)}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <canvas
          ref={canvasRef}
          className={canvasClass}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />

        <div className="drawing__sticker-layers">
          {stickerLayers.map((layer) => {
            const isActive = activeStickerId === layer.id;
            const box = layer.size * 1.35;
            const displaySrc = layerDisplaySrc(layer);
            return (
              <div
                key={layer.id}
                className={`drawing__sticker-layer ${isActive ? 'active' : ''}`}
                style={{
                  left: layer.x,
                  top: layer.y,
                  width: box,
                  height: box,
                  fontSize: layer.size,
                  transform: `translate(-50%, -50%) rotate(${layer.rotation}rad)`,
                }}
                onPointerDown={(e) => startStickerDrag(e, 'move', layer)}
              >
                <span className="drawing__sticker-emoji" aria-hidden>
                  {displaySrc ? (
                    <img
                      src={displaySrc}
                      alt=""
                      className="drawing__sticker-img"
                      style={{ width: layer.size, height: layer.size }}
                      draggable={false}
                    />
                  ) : (
                    layer.emoji
                  )}
                </span>
                {isActive && (
                  <>
                    <button
                      type="button"
                      className="drawing__photo-remove"
                      aria-label={t('canvas.removeOverlay')}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeActiveSticker();
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                        <path
                          d="M2 2l8 8M10 2L2 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="drawing__photo-confirm"
                      aria-label={t('common.save')}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmActiveSticker();
                      }}
                    >
                      ✓
                    </button>
                    <div
                      className="drawing__sticker-rotate"
                      title={t('canvas.stickerRotate')}
                      onPointerDown={(e) => startStickerDrag(e, 'rotate', layer)}
                    />
                    <div
                      className="drawing__photo-handle"
                      onPointerDown={(e) => startStickerDrag(e, 'resize', layer)}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
        </div>

        <div className="drawing__dock">
          {colorsOpen && mode === 'pen' && !editingOverlay && !fontOpen && (
            <>
              <div className="drawing__pen-kinds" role="group" aria-label={t('canvas.penKindAria')}>
                {PEN_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`drawing__pen-kind ${penKind === kind ? 'active' : ''}`}
                    aria-label={t(`canvas.penKind.${kind}`)}
                    title={t(`canvas.penKind.${kind}`)}
                    onClick={() => setPenKind(kind)}
                  >
                    <PenKindIcon kind={kind} />
                  </button>
                ))}
              </div>
              {customPickerOpen && (
                <div className="drawing__color-picker" role="dialog" aria-label={t('canvas.pickColorTitle')}>
                  <div className="drawing__color-picker-head">
                    <span className="drawing__color-picker-title">{t('canvas.pickColorTitle')}</span>
                    <span
                      className="drawing__color-picker-preview"
                      style={{ backgroundColor: customColor }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      className="drawing__color-picker-done"
                      onClick={() => setCustomPickerOpen(false)}
                    >
                      ✓
                    </button>
                  </div>
                  <div className="drawing__color-picker-mix">
                    <div
                      ref={hueWheelRef}
                      className="drawing__color-picker-wheel"
                      role="slider"
                      tabIndex={0}
                      aria-label="hue"
                      aria-valuemin={0}
                      aria-valuemax={360}
                      aria-valuenow={pickerHue}
                      onPointerDown={handleHueWheelPointer}
                      onPointerMove={(e) => {
                        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                        handleHueWheelPointer(e);
                      }}
                      onPointerUp={(e) => {
                        try {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      <span
                        className="drawing__color-picker-wheel-arm"
                        style={{ transform: `rotate(${pickerHue}deg)` }}
                        aria-hidden
                      >
                        <span
                          className="drawing__color-picker-wheel-knob"
                          style={{ backgroundColor: hslToHex(pickerHue, 70, 55) }}
                        />
                      </span>
                      <span
                        className="drawing__color-picker-wheel-center"
                        style={{ backgroundColor: customColor }}
                        aria-hidden
                      />
                    </div>
                    <div className="drawing__color-picker-light-wrap">
                      <span className="drawing__color-picker-light-label" aria-hidden>
                        밝기
                      </span>
                      <input
                        type="range"
                        className="drawing__color-picker-light"
                        min={22}
                        max={88}
                        value={pickerLight}
                        aria-label="lightness"
                        style={{
                          background: `linear-gradient(90deg, #1a1a1a, ${hslToHex(pickerHue, 58, 55)}, #fffef8)`,
                        }}
                        onChange={(e) => {
                          const light = Number(e.target.value);
                          applyPickerColor(pickerHue, light);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="drawing__colors" role="listbox" aria-label={t('canvas.pickColorTitle')}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="option"
                    aria-selected={color === c}
                    className={`drawing__color ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    aria-label={t(`canvas.colorAria`, { c })}
                    onClick={() => {
                      setCustomPickerOpen(false);
                      setColor(c);
                    }}
                  />
                ))}
                <button
                  type="button"
                  className={`drawing__color drawing__color--custom ${
                    color === customColor || customPickerOpen ? 'selected' : ''
                  }`}
                  title={t('canvas.pickColorTitle')}
                  aria-label={t('canvas.pickColorTitle')}
                  aria-expanded={customPickerOpen}
                  onClick={() => setCustomPickerOpen((open) => !open)}
                >
                  <span className="drawing__color-dot" style={{ backgroundColor: customColor }} />
                </button>
              </div>
            </>
          )}

          {mode === 'eraser' && !editingOverlay && (
            <div className="drawing__eraser-options">
              <div className="drawing__eraser-sizes" role="group" aria-label={t('canvas.eraserSizeAria')}>
                {ERASER_SIZES.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    className={`drawing__eraser-size ${eraserSizeId === size.id ? 'active' : ''}`}
                    onClick={() => setEraserSizeId(size.id)}
                  >
                    <span
                      className="drawing__eraser-preview"
                      style={{ width: size.width * 0.45, height: size.width * 0.45 }}
                    />
                    {t(`canvas.eraserSize.${size.id}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="drawing__clear-all"
                onClick={() => setClearConfirmOpen(true)}
              >
                {t('canvas.clearAll')}
              </button>
            </div>
          )}

          <div className="drawing__dock-bar" ref={dockBarRef}>
            <button
              type="button"
              className="drawing__dock-btn drawing__dock-btn--icon"
              disabled={!canUndo}
              aria-label={t('canvas.undo')}
              title={t('canvas.undo')}
              onClick={handleUndo}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13" />
              </svg>
            </button>
            <button
              type="button"
              className={`drawing__dock-btn drawing__dock-btn--tool ${mode === 'pen' && !fontOpen ? 'active' : ''}`}
              aria-label={t('canvas.pen')}
              title={t('canvas.pen')}
              onClick={selectPen}
            >
              <DockToolIcon name="pen" />
            </button>
            <button
              type="button"
              className="drawing__dock-btn drawing__dock-btn--tool"
              aria-label={t('canvas.photo')}
              title={t('canvas.photo')}
              onClick={() => {
                confirmActiveOverlay();
                setFontOpen(false);
                setStickerOpen(false);
                fileInputRef.current?.click();
              }}
            >
              <DockToolIcon name="photo" />
            </button>
            <button
              type="button"
              className={`drawing__dock-btn drawing__dock-btn--tool ${fontOpen ? 'active' : ''}`}
              aria-label={t('canvas.font')}
              title={t('canvas.font')}
              onClick={toggleFontPanel}
            >
              <DockToolIcon name="font" />
            </button>
            <button
              type="button"
              className={`drawing__dock-btn drawing__dock-btn--tool ${mode === 'sticker' || stickerOpen ? 'active' : ''}`}
              aria-label={t('canvas.sticker')}
              title={t('canvas.sticker')}
              onClick={toggleStickerPanel}
            >
              <DockToolIcon name="sticker" />
            </button>
            <button
              type="button"
              className={`drawing__dock-btn drawing__dock-btn--tool ${mode === 'eraser' ? 'active' : ''}`}
              aria-label={t('canvas.eraser')}
              title={t('canvas.eraser')}
              onClick={selectEraser}
            >
              <DockToolIcon name="eraser" />
            </button>
          </div>
        </div>
      </div>

      {stickerOpen && (
        <div className="drawing__sticker-panel" ref={stickerPanelRef}>
          <div className="drawing__sticker-panel-header">
            <div className="drawing__sticker-panel-head">
              <span>{t('canvas.stickerSheetTitle')}</span>
              <button
                type="button"
                className="sheet-close-btn"
                onClick={() => {
                  setStickerOpen(false);
                  setMode('none');
                  setColorsOpen(false);
                }}
                aria-label={t('common.close')}
              >
                <CloseIcon />
              </button>
            </div>

            <div
              className="drawing__sticker-tabs"
              ref={stickerTabsRef}
              role="tablist"
              aria-label={t('canvas.stickerCatsAria')}
            >
              {STICKER_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={stickerCategoryId === cat.id}
                  aria-label={t(`stickers.${cat.id}`)}
                  title={t(`stickers.${cat.id}`)}
                  className={`drawing__sticker-tab ${stickerCategoryId === cat.id ? 'active' : ''}`}
                  onClick={() => setStickerCategoryId(cat.id)}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="drawing__stickers" role="tabpanel">
            {(
              STICKER_CATEGORIES.find((c) => c.id === stickerCategoryId)?.items ?? []
            ).map((item, index) => {
              const value = stickerItemValue(item);
              const previewSrc = stickerDisplaySrc(value);
              return (
                <button
                  key={`${stickerCategoryId}-${value}-${index}`}
                  type="button"
                  className={`${selectedSticker === value ? 'selected' : ''}${previewSrc ? ' drawing__stickers-btn--image' : ''}`}
                  onClick={() => pickSticker(value)}
                >
                  {previewSrc ? (
                    <img src={previewSrc} alt="" className="drawing__sticker-thumb" />
                  ) : (
                    value
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {fontOpen && (
        <div className="drawing__font-panel">
          <div className="drawing__sticker-panel-head">
            <span>{t('canvas.fontPickerTitle')}</span>
            <button
              type="button"
              className="sheet-close-btn"
              onClick={() => setFontOpen(false)}
              aria-label={t('common.close')}
            >
              <CloseIcon />
            </button>
          </div>
          <FontSizePicker value={fontSizeId} onChange={selectFontSize} />
          <div className="drawing__fonts">
            {FONT_CATEGORIES.map((category) => {
              const items = langFonts.filter((f) => f.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} className="drawing__font-group">
                  <p className="drawing__font-category">{t(`font.cat.${category}`)}</p>
                  {items.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`drawing__font-item ${fontId === f.id ? 'selected' : ''}`}
                      style={{ fontFamily: f.family }}
                      onClick={() => pickFont(f.id)}
                    >
                      <span>{f.label}</span>
                      <span className="drawing__font-sample">{t('canvas.sample')}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {clearConfirmOpen && (
        <AppModal
          title={t('canvas.clearAll')}
          lead={t('canvas.confirm.clear')}
          onDismiss={() => setClearConfirmOpen(false)}
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('common.cancel')}
          onSecondary={() => setClearConfirmOpen(false)}
          primaryDanger
          primaryLabel={t('canvas.clearAll')}
          onPrimary={applyClearAll}
        />
      )}
    </div>
  );
}

export default DrawingCanvas;

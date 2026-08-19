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
import { STICKER_CATEGORIES, type StickerCategoryId } from '../utils/stickers';
import AppModal from './AppModal';
import CloseIcon from './CloseIcon';
import './DrawingCanvas.css';

export interface DrawingCanvasHandle {
  toDataURL: () => string | undefined;
  clear: () => void;
  loadImage: (src: string) => Promise<void>;
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
  '#333333',
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#3498db',
  '#9b59b6',
  '#8d6e63',
];

const FONT_CATEGORIES = ['cute', 'neat'] as const;
const PEN_KINDS: PenKind[] = ['ballpoint', 'gel', 'brush', 'marker', 'highlighter'];

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
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

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
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasDrawn = useRef(false);
  const undoStack = useRef<HTMLCanvasElement[]>([]);
  const strokeSnapshotPushed = useRef(false);
  const photoImages = useRef<Map<string, HTMLImageElement>>(new Map());
  const photoDrag = useRef<{
    kind: PhotoDragKind;
    id: string;
    startX: number;
    startY: number;
    origin: PhotoLayer;
    startAngle: number;
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
  const [customColor, setCustomColor] = useState('#e91e63');
  const [mode, setMode] = useState<ToolMode>('none');
  const [penKind, setPenKind] = useState<PenKind>('gel');
  const [stickerOpen, setStickerOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [stickerCategoryId, setStickerCategoryId] =
    useState<StickerCategoryId>('face');
  const [selectedSticker, setSelectedSticker] = useState<string>(
    STICKER_CATEGORIES[0].items[0],
  );
  const [eraserSizeId, setEraserSizeId] =
    useState<(typeof ERASER_SIZES)[number]['id']>('m');
  const [internalFontId, setInternalFontId] = useState(DEFAULT_FONT_ID);
  const fontId = fontIdProp ?? internalFontId;
  const [internalFontSizeId, setInternalFontSizeId] = useState(DEFAULT_FONT_SIZE_ID);
  const fontSizeId = parseFontSizeId(fontSizeIdProp ?? internalFontSizeId);
  const [photoLayers, setPhotoLayers] = useState<PhotoLayer[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
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

  const fillWhite = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
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

  const drawImageOnCanvas = (src: string, replace: boolean): Promise<void> =>
    new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error(t('canvas.err.noCanvas')));
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error(t('canvas.err.noContext')));
        return;
      }

      void materializeImageSrc(src)
        .then((safeSrc) => {
          const img = new Image();
          img.onload = () => {
            const rect = canvas.getBoundingClientRect();
            if (replace || !hasDrawn.current) {
              fillWhite();
            }

            const scale =
              Math.min(rect.width / img.width, rect.height / img.height) * 0.85;
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (rect.width - w) / 2;
            const y = (rect.height - h) / 2;
            ctx.drawImage(img, x, y, w, h);
            hasDrawn.current = true;
            resolve();
          };
          img.onerror = () => reject(new Error(t('canvas.err.imageLoad')));
          img.src = safeSrc;
        })
        .catch((err) => {
          reject(err instanceof Error ? err : new Error(t('canvas.err.imageLoad')));
        });
    });

  const exportDataUrl = (): string | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (
      !hasDrawn.current &&
      photoLayers.length === 0 &&
      stickerLayers.length === 0
    ) {
      return undefined;
    }

    try {
      if (photoLayers.length === 0 && stickerLayers.length === 0) {
        return hasDrawn.current ? canvas.toDataURL('image/png') : undefined;
      }

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return undefined;

      ctx.drawImage(canvas, 0, 0);
      photoLayers.forEach((layer) => bakePhotoToCanvas(layer, ctx));
      stickerLayers.forEach((layer) => bakeStickerToCanvas(layer, ctx));

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

  const bakeStickerToCanvas = (layer: StickerLayer, targetCtx?: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = targetCtx ?? canvas.getContext('2d');
    if (!ctx) return;

    const dpr = targetCtx ? (canvas.width / canvas.getBoundingClientRect().width || 1) : 1;
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

  const bakeAllPhotos = () => {
    photoLayers.forEach((layer) => bakePhotoToCanvas(layer));
    photoLayers.forEach((l) => photoImages.current.delete(l.id));
    setPhotoLayers([]);
    setActivePhotoId(null);
  };

  const bakeAllStickers = () => {
    stickerLayers.forEach((layer) => bakeStickerToCanvas(layer));
    setStickerLayers([]);
    setActiveStickerId(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
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
      fillWhite();
      if (snapshot) {
        ctx.drawImage(snapshot, 0, 0, rect.width, rect.height);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMove = (e: globalThis.PointerEvent) => {
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
              const scale = dist / originDist;
              const newWidth = Math.max(MIN_PHOTO_SIZE, origin.width * scale);
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
            // rotate
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
          // rotate
          const wrap = wrapRef.current?.getBoundingClientRect();
          if (!wrap) return layer;
          const cx = wrap.left + origin.x;
          const cy = wrap.top + origin.y;
          const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
          return { ...layer, rotation: origin.rotation + (angle - startAngle) };
        }),
      );
    };

    const onUp = () => {
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
    clear: () => {
      clearUndoStack();
      fillWhite();
      hasDrawn.current = false;
      photoImages.current.clear();
      setPhotoLayers([]);
      setActivePhotoId(null);
      setStickerLayers([]);
      setActiveStickerId(null);
    },
    hasContent: () =>
      hasDrawn.current || photoLayers.length > 0 || stickerLayers.length > 0,
    loadImage: async (src: string) => {
      bakeAllPhotos();
      bakeAllStickers();
      // AI 그림을 새 기준으로 두고, 「뒤로」로 AI 자체가 사라지지 않게 함
      await drawImageOnCanvas(src, true);
      clearUndoStack();
    },
  }));

  /** ✓ / 도구 전환 — 합치지 않고 선택만 해제 (다시 탭하면 이동·확대 가능) */
  const confirmActivePhoto = () => {
    setActivePhotoId(null);
  };

  const confirmActiveSticker = () => {
    setActiveStickerId(null);
    // ✓ 후엔 스티커 배치 종료 — 아무 데나 눌러도 더 이상 안 붙음
    setMode('pen');
    setStickerOpen(false);
    setColorsOpen(true);
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
    setMode('pen');
    setStickerOpen(false);
    setColorsOpen(true);
  };

  const confirmActiveOverlay = () => {
    setActivePhotoId(null);
    setActiveStickerId(null);
  };

  const switchTool = (next: ToolMode, openColors: boolean) => {
    confirmActiveOverlay();
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
        setMode('pen');
        setColorsOpen(true);
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

  const addPhotoLayer = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      const aspect = img.width / img.height;
      let width = rect.width * 0.55;
      let height = width / aspect;
      if (height > rect.height * 0.55) {
        height = rect.height * 0.55;
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
      setActivePhotoId(id);
      setMode('pen');
      setColorsOpen(false);
      setFontOpen(false);
      setStickerOpen(false);
    };
    img.src = dataUrl;
  };

  const placeStickerLayer = (emoji: string, x: number, y: number) => {
    confirmActiveOverlay();
    const id = createId();
    const layer: StickerLayer = {
      id,
      emoji,
      x,
      y,
      size: DEFAULT_STICKER_SIZE,
      rotation: 0,
    };
    setStickerLayers((prev) => [...prev, layer]);
    setActiveStickerId(id);
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
    setActivePhotoId(layer.id);

    const wrap = wrapRef.current?.getBoundingClientRect();
    const cx = (wrap?.left ?? 0) + layer.x + layer.width / 2;
    const cy = (wrap?.top ?? 0) + layer.y + layer.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);

    photoDrag.current = {
      kind,
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...layer },
      startAngle,
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

    const wrap = wrapRef.current?.getBoundingClientRect();
    const cx = (wrap?.left ?? 0) + layer.x;
    const cy = (wrap?.top ?? 0) + layer.y;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);

    stickerDrag.current = {
      kind,
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...layer },
      startAngle,
    };
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
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = eraserWidth;
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else {
      const pen = strokeStyleForPen();
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
    fillWhite();
    hasDrawn.current = false;
    photoImages.current.clear();
    setPhotoLayers([]);
    setActivePhotoId(null);
    setStickerLayers([]);
    setActiveStickerId(null);
    setClearConfirmOpen(false);
  };

  const canvasClass = [
    'drawing__canvas',
    mode === 'none' ? 'drawing__canvas--idle' : '',
    mode === 'eraser' ? 'drawing__canvas--eraser' : '',
    mode === 'sticker' ? 'drawing__canvas--sticker' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const editingOverlay = Boolean(activePhotoId || activeStickerId);

  return (
      <div className="drawing" data-no-swipe ref={rootRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="drawing__file-input"
        onChange={handlePhotoChange}
      />

      <div className="drawing__canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className={canvasClass}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />

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
                      aria-label={t('common.save')}
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

          {stickerLayers.map((layer) => {
            const isActive = activeStickerId === layer.id;
            const box = layer.size * 1.35;
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
                  {layer.emoji}
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
              <div className="drawing__colors">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`drawing__color ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    aria-label={t(`canvas.colorAria`, { c })}
                    onClick={() => setColor(c)}
                  />
                ))}
                <label
                  className={`drawing__color drawing__color--custom ${
                    color === customColor ? 'selected' : ''
                  }`}
                  title={t('canvas.pickColorTitle')}
                >
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setColor(e.target.value);
                    }}
                  />
                  <span className="drawing__color-dot" style={{ backgroundColor: customColor }} />
                </label>
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

          <div className="drawing__dock-bar">
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

      {stickerOpen && (
        <div className="drawing__sticker-panel">
          <div className="drawing__sticker-panel-head">
            <span>{t('canvas.stickerSheetTitle')}</span>
            <button
              type="button"
              className="sheet-close-btn"
              onClick={() => {
                setStickerOpen(false);
                setMode('pen');
                setColorsOpen(true);
              }}
              aria-label={t('common.close')}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="drawing__sticker-tabs" role="tablist" aria-label={t('canvas.stickerCatsAria')}>
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

          <div className="drawing__stickers" role="tabpanel">
            {(
              STICKER_CATEGORIES.find((c) => c.id === stickerCategoryId)?.items ?? []
            ).map((emoji, index) => (
              <button
                key={`${stickerCategoryId}-${emoji}-${index}`}
                type="button"
                className={selectedSticker === emoji ? 'selected' : ''}
                onClick={() => pickSticker(emoji)}
              >
                {emoji}
              </button>
            ))}
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

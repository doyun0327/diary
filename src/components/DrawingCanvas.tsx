import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_FONT_ID, FONTS, setPreferredFontId } from '../utils/fonts';
import { STICKER_CATEGORIES, type StickerCategoryId } from '../utils/stickers';
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

type ToolMode = 'pen' | 'eraser' | 'sticker';
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
const ERASER_SIZES = [
  { id: 's', width: 12 },
  { id: 'm', width: 24 },
  { id: 'l', width: 40 },
] as const;
const DEFAULT_STICKER_SIZE = 48;
const MIN_STICKER_SIZE = 22;
const MAX_STICKER_SIZE = 140;
const MIN_PHOTO_SIZE = 40;
const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

function DrawingCanvas({
  ref,
  fontId: fontIdProp,
  onFontIdChange,
}: DrawingCanvasProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasDrawn = useRef(false);
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
  const [mode, setMode] = useState<ToolMode>('pen');
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
  const [photoLayers, setPhotoLayers] = useState<PhotoLayer[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);

  const eraserWidth =
    ERASER_SIZES.find((s) => s.id === eraserSizeId)?.width ?? 24;

  const selectFont = (id: string) => {
    onFontIdChange?.(id);
    if (fontIdProp === undefined) setInternalFontId(id);
    setPreferredFontId(id);
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

      const img = new Image();
      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        if (replace || !hasDrawn.current) {
          fillWhite();
        }

        const scale = Math.min(rect.width / img.width, rect.height / img.height) * 0.85;
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (rect.width - w) / 2;
        const y = (rect.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        hasDrawn.current = true;
        resolve();
      };
      img.onerror = () => reject(new Error(t('canvas.err.imageLoad')));
      img.src = src;
    });

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
    photoLayers.forEach(bakePhotoToCanvas);
    photoLayers.forEach((l) => photoImages.current.delete(l.id));
    setPhotoLayers([]);
    setActivePhotoId(null);
  };

  const bakeAllStickers = () => {
    stickerLayers.forEach((layer) => bakeStickerToCanvas(layer));
    setStickerLayers([]);
    setActiveStickerId(null);
  };

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
      await drawImageOnCanvas(src, true);
    },
  }));

  const confirmActivePhoto = () => {
    if (!activePhotoId) return;
    const layer = photoLayers.find((l) => l.id === activePhotoId);
    if (!layer) return;
    bakePhotoToCanvas(layer);
    photoImages.current.delete(layer.id);
    setPhotoLayers((prev) => prev.filter((l) => l.id !== layer.id));
    setActivePhotoId(null);
  };

  const confirmActiveSticker = () => {
    if (!activeStickerId) return;
    const layer = stickerLayers.find((l) => l.id === activeStickerId);
    if (!layer) return;
    bakeStickerToCanvas(layer);
    setStickerLayers((prev) => prev.filter((l) => l.id !== layer.id));
    setActiveStickerId(null);
  };

  const confirmActiveOverlay = () => {
    if (activePhotoId) confirmActivePhoto();
    if (activeStickerId) confirmActiveSticker();
  };

  const switchTool = (next: ToolMode, openColors: boolean) => {
    confirmActiveOverlay();
    setMode(next);
    setStickerOpen(false);
    setFontOpen(false);
    setColorsOpen(openColors);
  };

  const selectPen = () => switchTool('pen', true);
  const selectEraser = () => switchTool('eraser', false);

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

      const id = crypto.randomUUID();
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
    const id = crypto.randomUUID();
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
    if (activeStickerId) confirmActiveSticker();
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
    if (activePhotoId) confirmActivePhoto();
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
    confirmActiveOverlay();

    if (mode === 'sticker') {
      e.preventDefault();
      const pos = getPos(e);
      placeStickerLayer(selectedSticker, pos.x, pos.y);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPos.current = getPos(e);
  };

  const handleMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (mode === 'sticker' || !drawing.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
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
  };

  const handleClear = () => {
    if (confirm(t('canvas.confirm.clear'))) {
      fillWhite();
      hasDrawn.current = false;
      photoImages.current.clear();
      setPhotoLayers([]);
      setActivePhotoId(null);
      setStickerLayers([]);
      setActiveStickerId(null);
    }
  };

  const canvasClass = [
    'drawing__canvas',
    mode === 'eraser' ? 'drawing__canvas--eraser' : '',
    mode === 'sticker' ? 'drawing__canvas--sticker' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const editingOverlay = Boolean(activePhotoId || activeStickerId);

  return (
    <div className="drawing">
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
                      className="drawing__photo-confirm"
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
                      className="drawing__photo-confirm"
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
                    onClick={() => setPenKind(kind)}
                  >
                    {t(`canvas.penKind.${kind}`)}
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
                onClick={handleClear}
              >
                {t('canvas.clearAll')}
              </button>
            </div>
          )}

          <div className="drawing__dock-bar">
            <button
              type="button"
              className={`drawing__dock-btn ${mode === 'pen' && !fontOpen ? 'active' : ''}`}
              onClick={selectPen}
            >
              {t('canvas.pen')}
            </button>
            <button
              type="button"
              className="drawing__dock-btn"
              onClick={() => {
                confirmActiveOverlay();
                setFontOpen(false);
                setStickerOpen(false);
                fileInputRef.current?.click();
              }}
            >
              {t('canvas.photo')}
            </button>
            <button
              type="button"
              className={`drawing__dock-btn ${fontOpen ? 'active' : ''}`}
              onClick={toggleFontPanel}
            >
              {t('canvas.font')}
            </button>
            <button
              type="button"
              className={`drawing__dock-btn ${mode === 'sticker' || stickerOpen ? 'active' : ''}`}
              onClick={toggleStickerPanel}
            >
              {t('canvas.sticker')}
            </button>
            <button
              type="button"
              className={`drawing__dock-btn ${mode === 'eraser' ? 'active' : ''}`}
              onClick={selectEraser}
            >
              {t('canvas.eraser')}
            </button>
          </div>
        </div>
      </div>

      {fontOpen && (
        <div className="drawing__font-panel">
          <div className="drawing__sticker-panel-head">
            <span>{t('canvas.fontPickerTitle')}</span>
            <button type="button" onClick={() => setFontOpen(false)}>
              {t('common.close')}
            </button>
          </div>
          <div className="drawing__fonts">
            {FONT_CATEGORIES.map((category) => (
              <div key={category} className="drawing__font-group">
                <p className="drawing__font-category">{t(`font.cat.${category}`)}</p>
                {FONTS.filter((f) => f.category === category).map((f) => (
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
            ))}
          </div>
        </div>
      )}

      {stickerOpen && (
        <div className="drawing__sticker-panel">
          <div className="drawing__sticker-panel-head">
            <span>{t('canvas.stickerSheetTitle')}</span>
            <button
              type="button"
              onClick={() => {
                setStickerOpen(false);
                setMode('pen');
                setColorsOpen(true);
              }}
            >
              {t('common.close')}
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
    </div>
  );
}

export default DrawingCanvas;

import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent, Ref } from 'react';
import { DEFAULT_FONT_ID, FONTS, FONT_CATEGORY_LABELS, findFont } from '../utils/fonts';
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
}

interface PhotoLayer {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspect: number;
}

type ToolMode = 'pen' | 'eraser' | 'sticker';
type PhotoDragKind = 'move' | 'resize';

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

const FONT_STORAGE_KEY = 'picture-diary-font';
const FONT_CATEGORIES = ['cute', 'neat'] as const;
const PEN_WIDTH = 3;
const ERASER_SIZES = [
  { id: 's', label: '작게', width: 12 },
  { id: 'm', label: '보통', width: 24 },
  { id: 'l', label: '크게', width: 40 },
] as const;
const STICKER_SIZE = 36;
const MIN_PHOTO_SIZE = 40;

function DrawingCanvas({ ref }: DrawingCanvasProps) {
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
  } | null>(null);

  const [color, setColor] = useState(COLORS[0]);
  const [customColor, setCustomColor] = useState('#e91e63');
  const [mode, setMode] = useState<ToolMode>('pen');
  const [stickerOpen, setStickerOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [stickerCategoryId, setStickerCategoryId] =
    useState<StickerCategoryId>('face');
  const [selectedSticker, setSelectedSticker] = useState(
    STICKER_CATEGORIES[0].items[0],
  );
  const [eraserSizeId, setEraserSizeId] =
    useState<(typeof ERASER_SIZES)[number]['id']>('m');
  const [fontId, setFontId] = useState(
    () => localStorage.getItem(FONT_STORAGE_KEY) ?? DEFAULT_FONT_ID,
  );
  const [photoLayers, setPhotoLayers] = useState<PhotoLayer[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const eraserWidth =
    ERASER_SIZES.find((s) => s.id === eraserSizeId)?.width ?? 24;

  useEffect(() => {
    const font = findFont(fontId);
    document.documentElement.style.setProperty('--diary-font', font.family);
    localStorage.setItem(FONT_STORAGE_KEY, fontId);
  }, [fontId]);

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
        reject(new Error('캔버스가 없습니다'));
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('캔버스 컨텍스트를 열 수 없습니다'));
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
      img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다'));
      img.src = src;
    });

  const bakePhotoToCanvas = (layer: PhotoLayer) => {
    const canvas = canvasRef.current;
    const img = photoImages.current.get(layer.id);
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
    hasDrawn.current = true;
  };

  const bakeAllPhotos = () => {
    photoLayers.forEach(bakePhotoToCanvas);
    photoLayers.forEach((l) => photoImages.current.delete(l.id));
    setPhotoLayers([]);
    setActivePhotoId(null);
  };

  const exportDataUrl = (): string | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (!hasDrawn.current && photoLayers.length === 0) return undefined;

    if (photoLayers.length === 0) {
      return hasDrawn.current ? canvas.toDataURL('image/png') : undefined;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.drawImage(canvas, 0, 0);
    photoLayers.forEach((layer) => {
      const img = photoImages.current.get(layer.id);
      if (img) ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
    });

    return exportCanvas.toDataURL('image/png');
  };

  const placeSticker = (emoji: string, x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.font = `${STICKER_SIZE}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
    ctx.restore();
    hasDrawn.current = true;
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
      if (!photoDrag.current) return;
      const { kind, id, startX, startY, origin } = photoDrag.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      setPhotoLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== id) return layer;
          if (kind === 'move') {
            return { ...layer, x: origin.x + dx, y: origin.y + dy };
          }
          const newWidth = Math.max(MIN_PHOTO_SIZE, origin.width + dx);
          const newHeight = newWidth / origin.aspect;
          return { ...layer, width: newWidth, height: newHeight };
        }),
      );
    };

    const onUp = () => {
      photoDrag.current = null;
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
    },
    hasContent: () => hasDrawn.current || photoLayers.length > 0,
    loadImage: async (src: string) => {
      bakeAllPhotos();
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

  const switchTool = (next: ToolMode, openColors: boolean) => {
    if (activePhotoId) confirmActivePhoto();
    setMode(next);
    setStickerOpen(false);
    setFontOpen(false);
    setColorsOpen(openColors);
  };

  const selectPen = () => switchTool('pen', true);
  const selectEraser = () => switchTool('eraser', false);

  const toggleFontPanel = () => {
    if (activePhotoId) confirmActivePhoto();
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
    if (activePhotoId) confirmActivePhoto();
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
    setFontId(id);
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
      };

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

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 넣을 수 있어요');
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
    setActivePhotoId(layer.id);
    photoDrag.current = {
      kind,
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      origin: layer,
    };
  };

  const getPos = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (activePhotoId) confirmActivePhoto();

    if (mode === 'sticker') {
      e.preventDefault();
      const pos = getPos(e);
      placeSticker(selectedSticker, pos.x, pos.y);
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
    ctx.strokeStyle = mode === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = mode === 'eraser' ? eraserWidth : PEN_WIDTH;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    hasDrawn.current = true;
  };

  const handleUp = () => {
    drawing.current = false;
  };

  const handleClear = () => {
    if (confirm('그림을 모두 지울까요?')) {
      fillWhite();
      hasDrawn.current = false;
      photoImages.current.clear();
      setPhotoLayers([]);
      setActivePhotoId(null);
    }
  };

  const canvasClass = [
    'drawing__canvas',
    mode === 'eraser' ? 'drawing__canvas--eraser' : '',
    mode === 'sticker' ? 'drawing__canvas--sticker' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
                      className="drawing__photo-handle"
                      onPointerDown={(e) => startPhotoDrag(e, 'resize', layer)}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {activePhotoId && (
          <p className="drawing__photo-hint">드래그로 이동 · 모서리로 크기 조절 · ✓ 로 붙이기</p>
        )}

        <div className="drawing__dock">
          {mode === 'sticker' && !stickerOpen && (
            <p className="drawing__sticker-hint">
              {selectedSticker} 선택됨 · 그림판을 눌러 붙이세요
            </p>
          )}

          {colorsOpen && mode === 'pen' && !activePhotoId && !fontOpen && (
            <div className="drawing__colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`drawing__color ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={`색상 ${c}`}
                  onClick={() => setColor(c)}
                />
              ))}
              <label
                className={`drawing__color drawing__color--custom ${
                  color === customColor ? 'selected' : ''
                }`}
                title="색 고르기"
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
          )}

          {mode === 'eraser' && !activePhotoId && (
            <div className="drawing__eraser-options">
              <div className="drawing__eraser-sizes" role="group" aria-label="지우개 크기">
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
                    {size.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="drawing__clear-all"
                onClick={handleClear}
              >
                전체 지우기
              </button>
            </div>
          )}

          <div className="drawing__dock-bar">
            <button
              type="button"
              className={`drawing__dock-btn ${mode === 'pen' && !fontOpen ? 'active' : ''}`}
              onClick={selectPen}
            >
              펜
            </button>
            <button
              type="button"
              className="drawing__dock-btn"
              onClick={() => {
                if (activePhotoId) confirmActivePhoto();
                setFontOpen(false);
                setStickerOpen(false);
                fileInputRef.current?.click();
              }}
            >
              사진
            </button>
            <button
              type="button"
              className={`drawing__dock-btn ${fontOpen ? 'active' : ''}`}
              onClick={toggleFontPanel}
            >
              글씨체
            </button>
            <button
              type="button"
              className={`drawing__dock-btn ${mode === 'sticker' || stickerOpen ? 'active' : ''}`}
              onClick={toggleStickerPanel}
            >
              스티커
            </button>
            <button
              type="button"
              className={`drawing__dock-btn ${mode === 'eraser' ? 'active' : ''}`}
              onClick={selectEraser}
            >
              지우개
            </button>
          </div>
        </div>
      </div>

      {fontOpen && (
        <div className="drawing__font-panel">
          <div className="drawing__sticker-panel-head">
            <span>글씨체 고르기</span>
            <button type="button" onClick={() => setFontOpen(false)}>
              닫기
            </button>
          </div>
          <div className="drawing__fonts">
            {FONT_CATEGORIES.map((category) => (
              <div key={category} className="drawing__font-group">
                <p className="drawing__font-category">{FONT_CATEGORY_LABELS[category]}</p>
                {FONTS.filter((f) => f.category === category).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`drawing__font-item ${fontId === f.id ? 'selected' : ''}`}
                    style={{ fontFamily: f.family }}
                    onClick={() => pickFont(f.id)}
                  >
                    <span>{f.label}</span>
                    <span className="drawing__font-sample">오늘의 diary</span>
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
            <span>스티커</span>
            <button
              type="button"
              onClick={() => {
                setStickerOpen(false);
                setMode('pen');
                setColorsOpen(true);
              }}
            >
              닫기
            </button>
          </div>

          <div className="drawing__sticker-tabs" role="tablist" aria-label="스티커 카테고리">
            {STICKER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={stickerCategoryId === cat.id}
                aria-label={cat.label}
                title={cat.label}
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

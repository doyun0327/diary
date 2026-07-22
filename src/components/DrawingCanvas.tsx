import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PointerEvent, Ref } from 'react';
import './DrawingCanvas.css';

export interface DrawingCanvasHandle {
  /** 그린 내용이 있으면 PNG data URL, 없으면 undefined */
  toDataURL: () => string | undefined;
  clear: () => void;
}

interface DrawingCanvasProps {
  ref?: Ref<DrawingCanvasHandle>;
}

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

const PEN_WIDTH = 3;
const ERASER_WIDTH = 20;

function DrawingCanvas({ ref }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasDrawn = useRef(false);

  const [color, setColor] = useState(COLORS[0]);
  const [customColor, setCustomColor] = useState('#e91e63');
  const [eraser, setEraser] = useState(false);

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

      // 크기 변경 시 비트맵이 초기화되므로 기존 그림을 백업했다가 다시 그림
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
      // scale()은 호출될 때마다 누적되므로 절대값으로 지정
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

  useImperativeHandle(ref, () => ({
    toDataURL: () =>
      hasDrawn.current ? canvasRef.current?.toDataURL('image/png') : undefined,
    clear: () => {
      fillWhite();
      hasDrawn.current = false;
    },
  }));

  const getPos = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPos.current = getPos(e);
  };

  const handleMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.strokeStyle = eraser ? '#ffffff' : color;
    ctx.lineWidth = eraser ? ERASER_WIDTH : PEN_WIDTH;
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
    }
  };

  return (
    <div className="drawing">
      <div className="drawing__toolbar">
        <div className="drawing__colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`drawing__color ${!eraser && color === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={`색상 ${c}`}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
            />
          ))}
          <label
            className={`drawing__color drawing__color--custom ${
              !eraser && color === customColor ? 'selected' : ''
            }`}
            title="원하는 색 고르기"
          >
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setColor(e.target.value);
                setEraser(false);
              }}
            />
            <span
              className="drawing__color-dot"
              style={{ backgroundColor: customColor }}
            />
          </label>
        </div>
        <div className="drawing__tools">
          <button
            type="button"
            className={eraser ? 'selected' : ''}
            onClick={() => setEraser((v) => !v)}
          >
            지우개
          </button>
          <button type="button" onClick={handleClear}>
            전체 지우기
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className={`drawing__canvas ${eraser ? 'drawing__canvas--eraser' : ''}`}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />
    </div>
  );
}

export default DrawingCanvas;

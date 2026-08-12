/** 이름 첫 글자로 원형 프로필 data URL 생성 */
export function letterAvatarDataUrl(letter: string, size = 320): string {
  const ch = (letter.trim() || '?').slice(0, 1).toUpperCase();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-accent-soft')
    .trim() || '#e8e4dc';
  const fg = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-accent-text')
    .trim() || '#3a342c';

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fg;
  ctx.font = `700 ${Math.round(size * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, size / 2, size / 2 + size * 0.02);

  return canvas.toDataURL('image/png');
}

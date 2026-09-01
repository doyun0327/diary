const TWEMOJI_BASE =
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

/** 국기·깃발 계열 — DOM/캔버스 텍스트로는 OS마다 깨지기 쉬움 */
export function isFlagEmoji(emoji: string): boolean {
  if (!emoji) return false;
  if (emoji === '🏁' || emoji === '🚩') return true;
  if (emoji.startsWith('🏳') || emoji.startsWith('🏴')) return true;
  const chars = [...emoji];
  if (chars.length < 2) return false;
  const a = chars[0].codePointAt(0) ?? 0;
  const b = chars[1].codePointAt(0) ?? 0;
  return a >= 0x1f1e6 && a <= 0x1f1ff && b >= 0x1f1e6 && b <= 0x1f1ff;
}

function emojiToCodepoint(emoji: string): string {
  const parts: string[] = [];
  let high = 0;
  for (let i = 0; i < emoji.length; i += 1) {
    const unit = emoji.charCodeAt(i);
    if (high) {
      parts.push((0x10000 + ((high - 0xd800) << 10) + (unit - 0xdc00)).toString(16));
      high = 0;
      continue;
    }
    if (unit >= 0xd800 && unit <= 0xdbff) {
      high = unit;
      continue;
    }
    parts.push(unit.toString(16));
  }
  return parts.join('-');
}

export function getFlagEmojiImageUrl(emoji: string): string {
  return `${TWEMOJI_BASE}/${emojiToCodepoint(emoji)}.png`;
}

export function getEmojiStickerImageUrl(emoji: string): string | null {
  if (!isFlagEmoji(emoji)) return null;
  return getFlagEmojiImageUrl(emoji);
}

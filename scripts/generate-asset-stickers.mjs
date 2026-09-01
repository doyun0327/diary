import fs from 'fs';
import path from 'path';

const stickersDir = path.resolve('public/stikers');
const outFile = path.resolve('src/utils/assetStickers.ts');

const files = fs
  .readdirSync(stickersDir)
  .filter((name) => /\.png$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'en'))
  .map((name) => `/stikers/${name}`);

const content = `/** public/stikers — regenerate with: node scripts/generate-asset-stickers.mjs */
export const ASSET_STICKER_SRCS = ${JSON.stringify(files, null, 2)} as const;

export const PACK_STICKER_CATEGORY = {
  id: 'pack',
  label: '일러스트',
  icon: '🎨',
  items: ASSET_STICKER_SRCS.map((src) => ({ src })),
} as const;

export function isAssetStickerSrc(value: string): boolean {
  return value.startsWith('/stikers/');
}
`;

fs.writeFileSync(outFile, content, 'utf8');
console.log(`Wrote ${files.length} stickers to ${path.relative(process.cwd(), outFile)}`);

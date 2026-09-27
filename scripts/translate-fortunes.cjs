/**
 * ko.json → 앱 지원 언어별 fortune JSON 번역 (배치)
 * Usage: node scripts/translate-fortunes.cjs [lang...]
 */
const fs = require('fs');
const path = require('path');
const { translate } = require('google-translate-api-x');

const outDir = path.join(__dirname, '../src/data/fortune');
const ko = JSON.parse(fs.readFileSync(path.join(outDir, 'ko.json'), 'utf8'));

const LANGS = {
  en: 'en',
  ja: 'ja',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  id: 'id',
  vi: 'vi',
  fr: 'fr',
  de: 'de',
  pt: 'pt',
  es: 'es',
  th: 'th',
};

const BATCH = 20;
const PAUSE_MS = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateBatch(texts, to) {
  const res = await translate(texts, {
    from: 'ko',
    to,
    rejectOnPartialFail: false,
  });
  const arr = Array.isArray(res) ? res : [res];
  return arr.map((r, i) => {
    const text = typeof r?.text === 'string' ? r.text.trim() : '';
    return text || texts[i];
  });
}

async function translateLang(appLang, googleCode) {
  const outPath = path.join(outDir, `${appLang}.json`);
  let out = [];
  if (fs.existsSync(outPath)) {
    try {
      out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    } catch {
      out = [];
    }
  }
  while (out.length < ko.length) out.push('');

  let filled = out.filter((s) => typeof s === 'string' && s.trim()).length;
  console.log(`[${appLang}] start filled=${filled}/${ko.length}`);

  for (let start = 0; start < ko.length; start += BATCH) {
    const end = Math.min(start + BATCH, ko.length);
    const missingIdx = [];
    for (let i = start; i < end; i++) {
      if (!out[i] || !String(out[i]).trim()) missingIdx.push(i);
    }
    if (missingIdx.length === 0) continue;

    const texts = missingIdx.map((i) => ko[i]);
    let attempt = 0;
    for (;;) {
      try {
        const translated = await translateBatch(texts, googleCode);
        missingIdx.forEach((i, j) => {
          out[i] = translated[j] || ko[i];
        });
        break;
      } catch (err) {
        attempt += 1;
        const wait = Math.min(10000, 600 * attempt);
        console.warn(
          `[${appLang}] batch ${start}-${end} retry ${attempt}: ${err.message || err}`,
        );
        await sleep(wait);
        if (attempt >= 10) {
          missingIdx.forEach((i) => {
            out[i] = ko[i];
          });
          break;
        }
      }
    }

    filled = out.filter((s) => typeof s === 'string' && s.trim()).length;
    fs.writeFileSync(outPath, JSON.stringify(out, null, 0), 'utf8');
    console.log(`[${appLang}] ${filled}/${ko.length}`);
    await sleep(PAUSE_MS);
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 0), 'utf8');
  console.log(`[${appLang}] done`);
}

async function main() {
  const only = process.argv.slice(2);
  const entries = Object.entries(LANGS).filter(
    ([k]) => only.length === 0 || only.includes(k),
  );
  // 2개 언어 병렬
  const concurrency = 2;
  for (let i = 0; i < entries.length; i += concurrency) {
    const slice = entries.slice(i, i + concurrency);
    await Promise.all(slice.map(([app, code]) => translateLang(app, code)));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

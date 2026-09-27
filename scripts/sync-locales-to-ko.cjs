/**
 * 모든 locale을 ko.json 키 구조에 맞추고,
 * 영어 잔존/누락 키는 한국어에서 번역한다.
 *
 * Usage: node scripts/sync-locales-to-ko.cjs [lang...]
 */
const fs = require('fs');
const path = require('path');
const { translate } = require('google-translate-api-x');

const localesDir = path.join(__dirname, '../src/i18n/locales');
const scriptsDir = __dirname;

const GOOGLE = {
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

const BATCH = 25;
const PAUSE_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

function unflatten(flat) {
  const root = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!isPlainObject(cur[p])) cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return root;
}

/** KO 트리 순서 유지하며 flat 값으로 재구성 */
function rebuildFromKoTree(koTree, flatValues) {
  if (!isPlainObject(koTree)) return flatValues;
  const out = {};
  for (const [k, v] of Object.entries(koTree)) {
    if (isPlainObject(v)) out[k] = rebuildFromKoTree(v, flatValues?.[k] !== undefined ? undefined : undefined);
    // use path-based: better rebuild via unflatten of filtered flat
  }
  return out;
}

function rebuildOrdered(koTree, flat, prefix = '') {
  if (!isPlainObject(koTree)) return flat[prefix];
  const out = {};
  for (const [k, v] of Object.entries(koTree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) out[k] = rebuildOrdered(v, flat, key);
    else out[k] = flat[key];
  }
  return out;
}

function shouldSkipTranslate(key, koVal, enVal) {
  if (key.startsWith('font.')) return true;
  if (key.startsWith('language.')) return true;
  if (typeof koVal !== 'string') return true;
  // KO와 EN이 같으면 번역 불필요 (고유명·기호 등)
  if (koVal === enVal) return true;
  return false;
}

function looksUntranslated(val, enVal, koVal) {
  if (val == null || val === '') return true;
  if (typeof val !== 'string') return false;
  if (val === enVal && enVal !== koVal) return true;
  // 다른 언어 파일에 한국어가 남아 있으면 재번역
  if (/[가-힣]/.test(val) && val === koVal) return true;
  return false;
}

function loadPatch(lang) {
  const p = path.join(scriptsDir, `i18n-tr-${lang}.json`);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
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

async function syncLang(lang, koFlat, enFlat, koTree) {
  const file = path.join(localesDir, `${lang}.json`);
  const existing = flatten(JSON.parse(fs.readFileSync(file, 'utf8')));
  const patch = loadPatch(lang);
  const googleCode = GOOGLE[lang];
  const out = {};
  const toTranslate = [];

  for (const key of Object.keys(koFlat)) {
    const koVal = koFlat[key];
    const enVal = enFlat[key];
    const cur = existing[key];
    const patched = patch[key];

    if (shouldSkipTranslate(key, koVal, enVal)) {
      // 폰트/언어명 등은 기존값 우선, 없으면 EN, 없으면 KO
      out[key] = cur ?? enVal ?? koVal;
      continue;
    }

    if (patched && typeof patched === 'string' && patched.trim()) {
      out[key] = patched;
      continue;
    }

    if (!looksUntranslated(cur, enVal, koVal)) {
      out[key] = cur;
      continue;
    }

    // EN 자체는 영어 유지 — 누락만 KO→EN 번역
    if (lang === 'en') {
      if (cur != null && cur !== '' && !/[가-힣]/.test(String(cur))) {
        out[key] = cur;
      } else {
        toTranslate.push(key);
        out[key] = koVal; // placeholder
      }
      continue;
    }

    toTranslate.push(key);
    out[key] = enVal ?? koVal; // temp until translated
  }

  console.log(`[${lang}] translate ${toTranslate.length} keys (patch had ${Object.keys(patch).length})`);

  if (toTranslate.length && googleCode) {
    for (let i = 0; i < toTranslate.length; i += BATCH) {
      const chunk = toTranslate.slice(i, i + BATCH);
      const texts = chunk.map((k) => String(koFlat[k]));
      let ok = false;
      for (let attempt = 0; attempt < 4 && !ok; attempt++) {
        try {
          const translated = await translateBatch(texts, googleCode);
          chunk.forEach((k, idx) => {
            out[k] = translated[idx];
          });
          ok = true;
          process.stdout.write(`  ${Math.min(i + BATCH, toTranslate.length)}/${toTranslate.length}\r`);
        } catch (e) {
          console.warn(`\n  retry ${attempt + 1} ${lang}:`, e.message || e);
          await sleep(1000 * (attempt + 1));
        }
      }
      if (!ok) console.warn(`\n  FAILED chunk at ${i} for ${lang}`);
      await sleep(PAUSE_MS);
    }
    console.log(`  done ${toTranslate.length}`);
  }

  const ordered = rebuildOrdered(koTree, out);
  fs.writeFileSync(file, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');

  const finalFlat = flatten(ordered);
  const missing = Object.keys(koFlat).filter((k) => !(k in finalFlat));
  const extra = Object.keys(finalFlat).filter((k) => !(k in koFlat));
  const stillEn = Object.keys(koFlat).filter((k) => {
    if (shouldSkipTranslate(k, koFlat[k], enFlat[k])) return false;
    if (lang === 'en') return false;
    return finalFlat[k] === enFlat[k] && enFlat[k] !== koFlat[k];
  });
  console.log(
    `[${lang}] keys=${Object.keys(finalFlat).length} missing=${missing.length} extra=${extra.length} stillEn=${stillEn.length}`,
  );
  if (stillEn.length && stillEn.length <= 20) console.log('  stillEn:', stillEn.join(', '));
  else if (stillEn.length) console.log('  stillEn sample:', stillEn.slice(0, 15).join(', '));
}

async function main() {
  const koTree = JSON.parse(fs.readFileSync(path.join(localesDir, 'ko.json'), 'utf8'));
  const enTree = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
  const koFlat = flatten(koTree);
  let enFlat = flatten(enTree);

  // EN도 KO 키와 동일 구조로 맞춘 뒤 시작
  const enOut = {};
  for (const key of Object.keys(koFlat)) {
    const cur = enFlat[key];
    if (cur != null && cur !== '' && !/[가-힣]/.test(String(cur))) enOut[key] = cur;
    else enOut[key] = koFlat[key]; // will translate
  }
  // Write EN structure first with placeholders; syncLang('en') will translate Hangul leftovers
  fs.writeFileSync(
    path.join(localesDir, 'en.json'),
    `${JSON.stringify(rebuildOrdered(koTree, enOut), null, 2)}\n`,
    'utf8',
  );
  enFlat = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')));

  const args = process.argv.slice(2).filter((a) => a !== 'ko');
  const langs = args.length ? args : Object.keys(GOOGLE);

  console.log('KO keys:', Object.keys(koFlat).length);
  console.log('langs:', langs.join(', '));

  // EN first so other langs compare against updated EN
  if (langs.includes('en')) {
    await syncLang('en', koFlat, enFlat, koTree);
    enFlat = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')));
  }

  for (const lang of langs) {
    if (lang === 'en') continue;
    await syncLang(lang, koFlat, enFlat, koTree);
  }

  console.log('ALL DONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'src/i18n/locales');

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge: fill missing keys in target from source; never overwrite existing */
function fillMissing(target, source) {
  if (!isPlainObject(source)) return target;
  const out = isPlainObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(source)) {
    if (!(k in out)) {
      out[k] = isPlainObject(v) ? fillMissing({}, v) : v;
    } else if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = fillMissing(out[k], v);
    }
  }
  return out;
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

const enPath = path.join(dir, 'en.json');
const koPath = path.join(dir, 'ko.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ko = JSON.parse(fs.readFileSync(koPath, 'utf8'));

// Cross-fill ko ↔ en so both have the same key set
const enFilled = fillMissing(en, ko);
const koFilled = fillMissing(ko, en);
fs.writeFileSync(enPath, `${JSON.stringify(enFilled, null, 2)}\n`, 'utf8');
fs.writeFileSync(koPath, `${JSON.stringify(koFilled, null, 2)}\n`, 'utf8');

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'en.json' && f !== 'ko.json');

let totalAdded = 0;
for (const f of files) {
  const filePath = path.join(dir, f);
  const before = flatten(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const filled = fillMissing(data, enFilled);
  const after = flatten(filled);
  const added = Object.keys(after).filter((k) => !(k in before)).length;
  totalAdded += added;
  fs.writeFileSync(filePath, `${JSON.stringify(filled, null, 2)}\n`, 'utf8');
  console.log(`${f}: added ${added} (now ${Object.keys(after).length})`);
}

const enFlat = flatten(enFilled);
let ok = true;
for (const f of files) {
  const flat = flatten(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const missing = Object.keys(enFlat).filter((k) => !(k in flat));
  if (missing.length) {
    ok = false;
    console.log(`STILL MISSING ${f} ${missing.length}`, missing.slice(0, 8));
  }
}
console.log(ok ? 'ALL SYNCED vs en' : 'INCOMPLETE');
console.log('totalAdded', totalAdded);
console.log('en keys', Object.keys(enFlat).length);
console.log('ko keys', Object.keys(flatten(koFilled)).length);

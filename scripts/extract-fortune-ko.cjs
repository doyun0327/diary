const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../src/data/fortuneMessages.ts');
const outDir = path.join(__dirname, '../src/data/fortune');
const t = fs.readFileSync(srcPath, 'utf8');

function extract(key) {
  const marker = `  ${key}: [`;
  const start = t.indexOf(marker);
  if (start < 0) throw new Error('no ' + key);
  const open = t.indexOf('[', start);
  let i = open + 1;
  let depth = 1;
  let inStr = false;
  let esc = false;
  let quote = '';
  for (; i < t.length && depth > 0; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') depth--;
  }
  const arrSrc = t.slice(open, i);
  return Function('return (' + arrSrc + ')')();
}

const ko = extract('ko');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'ko.json'), JSON.stringify(ko, null, 0), 'utf8');
console.log('ko', ko.length, 'wrote', path.join(outDir, 'ko.json'));
console.log('sample:', ko[0].slice(0, 60));

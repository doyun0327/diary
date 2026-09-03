const STOP = new Set([
  '오늘',
  '어제',
  '내일',
  '그제',
  '모레',
  '나는',
  '내가',
  '너는',
  '네가',
  '우리',
  '저희',
  '그리고',
  '그래서',
  '하지만',
  '근데',
  '그런데',
  '너무',
  '아주',
  '정말',
  '진짜',
  '그냥',
  '조금',
  '많이',
  '있다',
  '없다',
  '하다',
  '했다',
  '했어',
  '해요',
  '이것',
  '그것',
  '저것',
  '여기',
  '거기',
  '저기',
  'the',
  'and',
  'but',
  'with',
  'from',
  'was',
  'were',
  'have',
  'had',
  'this',
  'that',
  'my',
  'me',
  'we',
  'you',
]);

const PARTICLES = [
  '이에요',
  '예요',
  '입니다',
  '습니다',
  '했어요',
  '이었다',
  '였다',
  '했다',
  '했어',
  '이다',
  '부터',
  '까지',
  '처럼',
  '같이',
  '에서',
  '으로',
  '에게',
  '한테',
  '를',
  '을',
  '은',
  '는',
  '이',
  '가',
  '의',
  '에',
  '와',
  '과',
  '도',
  '만',
  '로',
  '요',
  '다',
];

function stemKorean(token: string): string {
  for (const particle of PARTICLES) {
    if (token.length - particle.length >= 2 && token.endsWith(particle)) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

function stem(token: string): string {
  if (/^[\uac00-\ud7a3]+$/.test(token)) return stemKorean(token);
  return token.toLowerCase();
}

function isKeyword(token: string): boolean {
  if (token.length < 2) return false;
  if (STOP.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  return true;
}

function tokensFromSentence(sentence: string): string[] {
  return sentence
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => stem(token.trim()))
    .filter(isKeyword);
}

/** 문장 순서대로 단어들. 생성 대기 중 여러 개가 겹쳐 fade 된다. */
export function keywordsFromDiary(text: string): string[] {
  const sentences = text
    .split(/[.!?。！？…\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const words: string[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    for (const word of tokensFromSentence(sentence)) {
      if (seen.has(word)) continue;
      seen.add(word);
      words.push(word);
      if (words.length >= 40) return words;
    }
  }
  return words;
}

import privacyHtml from '../../public/privacy.html?raw';

const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'pt', 'fr', 'de', 'vi', 'th', 'id'] as const;

export function privacyPolicyLang(raw: string | null | undefined): string {
  const lower = (raw ?? '').trim().toLowerCase().replace('_', '-');
  if (!lower) return 'ko';
  if (
    lower === 'zh-tw' ||
    lower === 'zh-hant' ||
    lower.startsWith('zh-tw') ||
    lower.startsWith('zh-hant')
  ) {
    return 'zh-TW';
  }
  if (lower.startsWith('zh')) return 'zh';
  for (const lang of LANGS) {
    const key = lang.toLowerCase();
    if (lower === key || lower.startsWith(`${key}-`)) return lang;
  }
  return 'en';
}

const articleCache = new Map<string, string>();

/** 앱에 묶인 privacy.html 에서 해당 언어 본문만 꺼낸다. */
export function privacyPolicyArticleHtml(lang: string): string {
  const key = privacyPolicyLang(lang);
  const cached = articleCache.get(key);
  if (cached != null) return cached;

  const doc = new DOMParser().parseFromString(privacyHtml, 'text/html');
  const article =
    doc.querySelector(`article[data-lang="${key}"]`) ??
    doc.querySelector('article[data-lang="en"]');
  const html = article?.innerHTML ?? '';
  articleCache.set(key, html);
  return html;
}

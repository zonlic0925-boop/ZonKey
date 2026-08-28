export interface TextStats {
  chars: number;
  charsNoSpaces: number;
  words: number;
  lines: number;
  paragraphs: number;
  chineseChars: number;
  englishWords: number;
  numbers: number;
  readingTimeMinutes: number;
}

export function analyzeTextStats(text: string): TextStats {
  const chars = text.length;
  const charsNoSpaces = text.replace(/\\s/g, '').length;
  const lines = text ? text.split(/\r?\n/).length : 0;
  const paragraphs = text ? text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length : 0;

  const chineseMatches = text.match(/[\u4e00-\u9fa5]/g);
  const chineseChars = chineseMatches ? chineseMatches.length : 0;

  const englishMatches = text.match(/[a-zA-Z]+/g);
  const englishWords = englishMatches ? englishMatches.length : 0;

  const numberMatches = text.match(/\d+/g);
  const numbers = numberMatches ? numberMatches.length : 0;

  const words = englishWords + chineseChars;
  const readingTimeMinutes = Math.ceil(words / 300);

  return {
    chars,
    charsNoSpaces,
    words,
    lines,
    paragraphs,
    chineseChars,
    englishWords,
    numbers,
    readingTimeMinutes,
  };
}

export function convertCase(text: string, type: 'upper' | 'lower' | 'title' | 'camel' | 'kebab' | 'snake'): string {
  switch (type) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'title':
      return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    case 'camel':
      return text
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
        .replace(/^[^a-zA-Z0-9]+/, '');
    case 'kebab':
      return text
        .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        ?.map((x) => x.toLowerCase())
        .join('-') || text;
    case 'snake':
      return text
        .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        ?.map((x) => x.toLowerCase())
        .join('_') || text;
    default:
      return text;
  }
}

export function cleanText(text: string, options: { removeEmptyLines?: boolean; trimLines?: boolean; removeSpaces?: boolean; dedupeSpaces?: boolean }): string {
  let result = text;
  if (options.trimLines) {
    result = result.split('\n').map(l => l.trim()).join('\n');
  }
  if (options.dedupeSpaces) {
    result = result.replace(/[ \t]+/g, ' ');
  }
  if (options.removeSpaces) {
    result = result.replace(/[ \t]/g, '');
  }
  if (options.removeEmptyLines) {
    result = result.split('\n').filter(l => l.trim().length > 0).join('\n');
  }
  return result;
}

export function diffSimple(text1: string, text2: string): { type: 'same' | 'added' | 'removed'; line: string }[] {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const result: { type: 'same' | 'added' | 'removed'; line: string }[] = [];

  const max = Math.max(lines1.length, lines2.length);
  for (let i = 0; i < max; i++) {
    const l1 = lines1[i];
    const l2 = lines2[i];
    if (l1 === l2) {
      if (l1 !== undefined) result.push({ type: 'same', line: l1 });
    } else {
      if (l1 !== undefined) result.push({ type: 'removed', line: l1 });
      if (l2 !== undefined) result.push({ type: 'added', line: l2 });
    }
  }
  return result;
}

export function analyzeText(text: string) {
  const stats = analyzeTextStats(text);
  return {
    totalChars: stats.chars,
    chineseChars: stats.chineseChars,
    englishWords: stats.englishWords,
    digits: (text.match(/\d/g) || []).length,
    lines: stats.lines,
    paragraphs: stats.paragraphs,
    readingTimeMinutes: stats.readingTimeMinutes,
    whitespace: (text.match(/\s/g) || []).length
  };
}

export function diffTexts(textA: string, textB: string): { type: 'added' | 'removed' | 'unchanged'; value: string }[] {
  const diffs = diffSimple(textA, textB);
  return diffs.map(d => ({
    type: (d.type === 'added' ? 'added' : d.type === 'removed' ? 'removed' : 'unchanged') as 'added' | 'removed' | 'unchanged',
    value: d.line + '\n'
  }));
}

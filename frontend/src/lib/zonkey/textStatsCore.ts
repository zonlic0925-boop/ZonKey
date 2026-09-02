/**
 * 文本统计核心 — 中英字符/词汇/阅读时长/段落分析。
 * 单遍扫描：字符/词/行/段/句、中英文频次、阅读/朗读时长、词汇丰富度。
 */

export const TEXT_STATS_LIMITS = Object.freeze({
  maxInputChars: 1_000_000,
  maxDocumentBytes: 64 * 1024 * 1024,
  maxPdfPages: 300,
  maxTopItems: 8,
});

const LINE_BREAK = /\r\n?|\n/;
const HAN_CHARACTER = /\p{Script=Han}/u;
const WHITESPACE = /\s/u;
const SENTENCE_PUNCTUATION = new Set(['。', '！', '？', '.', '!']);
const PUNCTUATION = new Set(['，', '。', '！', '？', '、', '；', '：', '“', '”', '‘', '’', '（', '）', '【', '】', '《', '》', '…', '—', '·', ',', '.', '!', '?', ';', ':', '"', "'", '(', ')', '[', ']', '{', '}']);
const ENGLISH_WORD_PATTERN = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
const NUMBER_PATTERN = /[0-9]+(?:[.,][0-9]+)*/g;

export interface TopItem {
  text: string;
  count: number;
}

export interface TextStatsResult {
  chars: number;
  charsNoSpace: number;
  spaces: number;
  words: number;
  englishWords: number;
  lines: number;
  paragraphs: number;
  sentences: number;
  chineseChars: number;
  letters: number;
  uppercase: number;
  lowercase: number;
  digits: number;
  punctuation: number;
  longestLine: number;
  avgLineLength: number;
  readingTime: number;
  speakingTime: number;
  nonEmptyLines: number;
  numbers: number;
  uniqueWords: number;
  repeatedWords: number;
  avgWordLength: number;
  avgSentenceLength: number;
  lexicalDensity: number;
  topWords: TopItem[];
  topChineseChars: TopItem[];
}

export function calculateTextStats(text: string): TextStatsResult {
  if (typeof text !== 'string') throw new TypeError('Text statistics input must be a string.');
  if (text.length > TEXT_STATS_LIMITS.maxInputChars) {
    throw new RangeError(`Text statistics input exceeds ${TEXT_STATS_LIMITS.maxInputChars} UTF-16 code units.`);
  }
  if (!text) {
    return {
      chars: 0, charsNoSpace: 0, spaces: 0, words: 0, englishWords: 0,
      lines: 0, paragraphs: 0, sentences: 0, chineseChars: 0, letters: 0,
      uppercase: 0, lowercase: 0, digits: 0, punctuation: 0, longestLine: 0,
      avgLineLength: 0, readingTime: 0, speakingTime: 0, nonEmptyLines: 0,
      numbers: 0, uniqueWords: 0, repeatedWords: 0, avgWordLength: 0,
      avgSentenceLength: 0, lexicalDensity: 0, topWords: [], topChineseChars: [],
    };
  }

  let chars = 0;
  let charsNoSpace = 0;
  let spaces = 0;
  let chineseChars = 0;
  let letters = 0;
  let uppercase = 0;
  let lowercase = 0;
  let digits = 0;
  let punctuation = 0;
  let sentences = 0;
  let lines = 1;
  let currentLineLength = 0;
  let longestLine = 0;
  let lineChars = 0;
  let previousWasCarriageReturn = false;
  let sentenceHasContent = false;
  const englishFrequency = new Map<string, number>();
  const chineseFrequency = new Map<string, number>();

  for (const character of text) {
    chars += 1;
    const isWhitespace = WHITESPACE.test(character);
    if (!isWhitespace) charsNoSpace += 1;
    if (character === ' ') spaces += 1;
    if (HAN_CHARACTER.test(character)) {
      chineseChars += 1;
      chineseFrequency.set(character, (chineseFrequency.get(character) || 0) + 1);
    }
    const code = character.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      letters += 1;
      uppercase += 1;
    } else if (code >= 97 && code <= 122) {
      letters += 1;
      lowercase += 1;
    } else if (code >= 48 && code <= 57) {
      digits += 1;
    }
    if (PUNCTUATION.has(character)) punctuation += 1;

    if (character === '\r') {
      lineChars += currentLineLength;
      longestLine = Math.max(longestLine, currentLineLength);
      currentLineLength = 0;
      lines += 1;
      previousWasCarriageReturn = true;
      continue;
    }
    if (character === '\n') {
      if (!previousWasCarriageReturn) {
        lineChars += currentLineLength;
        longestLine = Math.max(longestLine, currentLineLength);
        currentLineLength = 0;
        lines += 1;
      }
      previousWasCarriageReturn = false;
      continue;
    }
    previousWasCarriageReturn = false;
    currentLineLength += 1;
    if (SENTENCE_PUNCTUATION.has(character)) {
      if (sentenceHasContent) sentences += 1;
      sentenceHasContent = false;
    } else if (!isWhitespace) {
      sentenceHasContent = true;
    }
  }

  lineChars += currentLineLength;
  longestLine = Math.max(longestLine, currentLineLength);
  if (sentenceHasContent) sentences += 1;

  let englishWords = 0;
  for (const match of text.matchAll(ENGLISH_WORD_PATTERN)) {
    englishWords += 1;
    const normalized = match[0].toLowerCase();
    englishFrequency.set(normalized, (englishFrequency.get(normalized) || 0) + 1);
  }
  let numbers = 0;
  for (const _match of text.matchAll(NUMBER_PATTERN)) numbers += 1;
  const words = chineseChars + englishWords;
  let paragraphs = 0;
  let nonEmptyLines = 0;
  let inParagraph = false;
  for (const line of text.split(LINE_BREAK)) {
    if (line.trim()) {
      nonEmptyLines += 1;
      if (!inParagraph) paragraphs += 1;
      inParagraph = true;
    } else {
      inParagraph = false;
    }
  }
  const avgLineLength = lines > 0 ? Math.round(lineChars / lines) : 0;
  const readingTime = words > 0 ? Math.max(1, Math.ceil(words / 300)) : 0;
  const speakingTime = words > 0 ? Math.max(1, Math.ceil(words / 180)) : 0;
  const uniqueWords = englishFrequency.size + chineseFrequency.size;
  let repeatedWords = 0;
  for (const count of englishFrequency.values()) if (count > 1) repeatedWords += 1;
  for (const count of chineseFrequency.values()) if (count > 1) repeatedWords += 1;
  const avgWordLength = englishWords > 0 ? Math.round((letters / englishWords) * 10) / 10 : 0;
  const avgSentenceLength = sentences > 0 ? Math.round((words / sentences) * 10) / 10 : 0;
  const lexicalDensity = words > 0 ? Math.round((uniqueWords / words) * 100) : 0;
  const frequencySorter = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
  const topWords = Array.from(englishFrequency.entries())
    .filter(([word]) => word.length > 1)
    .sort(frequencySorter)
    .slice(0, TEXT_STATS_LIMITS.maxTopItems)
    .map(([word, count]) => ({ text: word, count }));
  const topChineseChars = Array.from(chineseFrequency.entries())
    .sort(frequencySorter)
    .slice(0, TEXT_STATS_LIMITS.maxTopItems)
    .map(([character, count]) => ({ text: character, count }));

  return {
    chars, charsNoSpace, spaces, words, englishWords, lines, paragraphs,
    sentences, chineseChars, letters, uppercase, lowercase, digits, punctuation,
    longestLine,
    avgLineLength, readingTime, speakingTime, nonEmptyLines, numbers,
    uniqueWords, repeatedWords, avgWordLength, avgSentenceLength, lexicalDensity,
    topWords, topChineseChars,
  };
}

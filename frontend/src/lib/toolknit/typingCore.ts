/**
 * 打字测试核心逻辑 —— 移植自 ToolKnit 2.1.1 main.js 打字测试段。
 * 纯函数部分（词库、出题、评分、评级）与 UI 解耦，便于测试。
 */

import { typingWordsData } from './typingWords';

export type TypingLang = 'en' | 'zh';
export type TypingDifficulty = 'easy' | 'medium' | 'hard' | 'master';

interface WordPools {
  en: Record<TypingDifficulty, string[]>;
  zh: Record<TypingDifficulty, string[]>;
}

/** 代码内补充词库（与 ToolKnit TYPING_TEST_EXTRA_WORDS 一致） */
const EXTRA_WORDS: WordPools = {
  en: {
    easy: ['apple', 'cloud', 'smile', 'green', 'light', 'music', 'paper', 'chair', 'phone', 'fresh', 'clean', 'dream'],
    medium: ['algorithm', 'database', 'clipboard', 'render', 'command', 'vector', 'payload', 'context', 'session', 'shortcut', 'timeline', 'routing'],
    hard: ['interoperability', 'standardization', 'synchronization', 'abstraction', 'architecture', 'concurrency', 'maintainability', 'verification', 'distribution', 'resilience', 'customization', 'integration'],
    master: ['async await', 'tree shaking', 'code review', 'hot reload', 'design system', 'source map', 'edge case', 'feature flag', 'memory leak', 'race condition', 'live preview', 'release candidate'],
  },
  zh: {
    easy: ['星光', '绿叶', '小溪', '风铃', '书页', '阳光', '蓝天', '白云', '微风', '清香', '细雨', '田野'],
    medium: ['选择决定方向', '思考带来进步', '规划提高效率', '复盘促进成长', '耐心解决问题', '记录灵感很重要', '专注会带来结果', '沟通让合作更顺畅', '目标清晰才能前进', '经验需要不断积累', '每一次练习都算数', '认真打磨作品'],
    hard: ['不忘初心方得始终', '行稳致远静待花开', '路虽远行则将至', '事虽难做则必成', '纸上得来终觉浅', '绝知此事要躬行', '博观而约取厚积而薄发', '天行健君子以自强不息', '地势坤君子以厚德载物', '少年辛苦终身事', '莫向光阴惰寸功', '学无止境知行合一'],
    master: ['大鹏一日同风起扶摇直上九万里', '安得广厦千万间大庇天下寒士俱欢颜', '朱门酒肉臭路有冻死骨', '苟利国家生死以岂因祸福避趋之', '路漫漫其修远兮吾将上下而求索', '业精于勤荒于嬉行成于思毁于随', '少壮不努力老大徒伤悲', '青春须早为岂能长少年', '车到山前必有路', '船到桥头自然直', '功夫不负有心人', '只争朝夕不负韶华'],
  },
};

const WORDS: WordPools = {
  en: {
    easy: [...typingWordsData.en.easy, ...EXTRA_WORDS.en.easy],
    medium: [...typingWordsData.en.medium, ...EXTRA_WORDS.en.medium],
    hard: [...typingWordsData.en.hard, ...EXTRA_WORDS.en.hard],
    master: [...typingWordsData.en.master, ...EXTRA_WORDS.en.master],
  },
  zh: {
    easy: [...typingWordsData.zh.easy, ...EXTRA_WORDS.zh.easy],
    medium: [...typingWordsData.zh.medium, ...EXTRA_WORDS.zh.medium],
    hard: [...typingWordsData.zh.hard, ...EXTRA_WORDS.zh.hard],
    master: [...typingWordsData.zh.master, ...EXTRA_WORDS.zh.master],
  },
};

const NOISE_RE = /[\s\u3000，。！？、；：\u201c\u201d\u2018\u2019（）【】《》…—·,.!?;:"'()[\]{}]/g;

export const TYPING_DURATIONS = [15, 30, 60, 120] as const;
export const TYPING_COUNT_BY_DIFFICULTY: Record<TypingDifficulty, number> = {
  easy: 24, medium: 18, hard: 14, master: 12,
};

export function normalizeTypingValue(text: string | null | undefined) {
  return (text || '').replace(NOISE_RE, '');
}

export function sampleTypingWords(pool: string[] | undefined, count: number) {
  const uniquePool = Array.from(new Set((pool || []).filter(Boolean)));
  if (!uniquePool.length || count <= 0) return [];
  const bag = [...uniquePool];
  const result: string[] = [];
  while (result.length < count) {
    if (!bag.length) bag.push(...uniquePool);
    const idx = Math.floor(Math.random() * bag.length);
    result.push(bag.splice(idx, 1)[0]);
  }
  return result;
}

export function generateTypingText(lang: TypingLang, difficulty: TypingDifficulty) {
  const pool = WORDS[lang]?.[difficulty] || WORDS.zh.easy;
  const parts = sampleTypingWords(pool, TYPING_COUNT_BY_DIFFICULTY[difficulty]);
  return parts.join(' ');
}

export interface TypingStats {
  wpm: number;
  cpm: number;
  accuracy: number;
  correct: number;
  wrong: number;
  total: number;
}

/** 逐字符比对（忽略空白与标点）统计成绩。elapsedMinutes ≤ 0 时速度为 0。 */
export function computeTypingStats(
  targetText: string,
  inputText: string,
  elapsedMinutes: number,
): TypingStats {
  const normalizedTarget = normalizeTypingValue(targetText);
  const normalizedInput = normalizeTypingValue(inputText);
  const targetChars = normalizedTarget.split('');
  const inputChars = normalizedInput.split('');
  const compareLen = Math.min(targetChars.length, inputChars.length);
  let correct = 0;
  for (let i = 0; i < compareLen; i++) {
    if (targetChars[i] === inputChars[i]) correct++;
  }
  const wrong = Math.max(inputChars.length - correct, 0);
  const elapsed = elapsedMinutes > 0 ? elapsedMinutes : 0;
  const cpm = elapsed > 0 ? Math.round(correct / elapsed) : 0;
  const wpm = elapsed > 0 ? Math.round(correct / 5 / elapsed) : 0;
  const accuracy = inputChars.length > 0 ? Math.round((correct / inputChars.length) * 100) : 100;
  return { wpm, cpm, accuracy, correct, wrong, total: inputChars.length };
}

export function getTypingRating(wpm: number, lang: TypingLang) {
  if (lang === 'zh') {
    if (wpm >= 120) return 'S';
    if (wpm >= 100) return 'A';
    if (wpm >= 80) return 'B';
    if (wpm >= 60) return 'C';
    return 'D';
  }
  if (wpm >= 80) return 'S';
  if (wpm >= 60) return 'A';
  if (wpm >= 40) return 'B';
  if (wpm >= 20) return 'C';
  return 'D';
}

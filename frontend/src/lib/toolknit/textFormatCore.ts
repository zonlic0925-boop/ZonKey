/**
 * 文本排版核心 — 1:1 移植自 ToolKnit text-format-core.js。
 * 16 种排版动作：大小写、空格/空行治理、排序、行号、反转、全半角（盘古之白类基础）。
 */

export const TEXT_FORMAT_LIMITS = Object.freeze({
  maxInputChars: 1_000_000,
  maxLines: 100_000,
});

const lineSplitter = /\r\n?|\n/;
const lineCollator = new Intl.Collator('zh-Hans-u-co-pinyin', { numeric: true, sensitivity: 'base' });
const graphemeSegmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

export type TextFormatErrorCode =
  | 'input_too_long'
  | 'result_too_long'
  | 'too_many_lines'
  | 'invalid_action';

export class TextFormatError extends RangeError {
  code: TextFormatErrorCode;
  constructor(code: TextFormatErrorCode, message: string) {
    super(message);
    this.name = 'TextFormatError';
    this.code = code;
  }
}

function reverseGraphemes(text: string): string {
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)]
      .map((segment) => segment.segment)
      .reverse()
      .join('');
  }
  return [...text].reverse().join('');
}

export function assertTextFormatInput(text: string): void {
  if (typeof text !== 'string') throw new TypeError('Text formatter input must be a string.');
  if (text.length > TEXT_FORMAT_LIMITS.maxInputChars) {
    throw new TextFormatError('input_too_long', `Text formatter input exceeds ${TEXT_FORMAT_LIMITS.maxInputChars} characters.`);
  }
}

function assertTextFormatOutput(text: string): void {
  if (text.length > TEXT_FORMAT_LIMITS.maxInputChars) {
    throw new TextFormatError('result_too_long', `Text formatter result exceeds ${TEXT_FORMAT_LIMITS.maxInputChars} characters.`);
  }
}

function splitFormatLines(text: string): string[] {
  let lineCount = 1;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 13) {
      lineCount += 1;
      if (text.charCodeAt(index + 1) === 10) index += 1;
    } else if (code === 10) {
      lineCount += 1;
    }
    if (lineCount > TEXT_FORMAT_LIMITS.maxLines) {
      throw new TextFormatError('too_many_lines', `Text formatter supports at most ${TEXT_FORMAT_LIMITS.maxLines} lines.`);
    }
  }
  return text.split(lineSplitter);
}

function removeSequentialLineNumbers(text: string): string {
  const lines = splitFormatLines(text);
  let expectedNumber = 1;
  let sequenceLength = 0;
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)[.、)]\s+/);
    if (!match || Number.parseInt(match[1], 10) !== expectedNumber) break;
    expectedNumber += 1;
    sequenceLength += 1;
  }
  if (sequenceLength < 2) return text;
  return lines
    .map((line, index) => (index < sequenceLength ? line.replace(/^\s*\d+[.、)]\s+/, '') : line))
    .join('\n');
}

export function toHalfWidth(text: string): string {
  return text
    .replace(/[\uFF01-\uFF5E]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ');
}

export function toFullWidth(text: string): string {
  return text.replace(/[\u0020-\u007E]/g, (character) =>
    character === ' ' ? '\u3000' : String.fromCharCode(character.charCodeAt(0) + 0xFEE0),
  );
}

export type TextFormatAction =
  | 'uppercase' | 'lowercase' | 'titlecase' | 'capitalize'
  | 'trimSpaces' | 'trimLines' | 'removeEmptyLines' | 'removeDuplicateLines'
  | 'sortAsc' | 'sortDesc' | 'addLineNumbers' | 'removeLineNumbers'
  | 'reverseLines' | 'reverseText' | 'toHalfWidth' | 'toFullWidth';

export function executeTextFormat(action: TextFormatAction, text: string): string {
  assertTextFormatInput(text);
  if (!text) return '';
  let result: string;
  switch (action) {
    case 'uppercase': result = text.toUpperCase(); break;
    case 'lowercase': result = text.toLowerCase(); break;
    case 'titlecase': result = text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()); break;
    case 'capitalize': result = text
      .replace(/([.!?。！？]\s*)([a-z\u4e00-\u9fff])/g, (_m, prefix: string, character: string) => prefix + character.toUpperCase())
      .replace(/^([a-z\u4e00-\u9fff])/, (m, character: string) => character.toUpperCase()); break;
    case 'trimSpaces': result = text.replace(/[ \t]+/g, ' ').replace(/^[ \t]+|[ \t]+$/gm, ''); break;
    case 'trimLines': result = splitFormatLines(text).map((line) => line.trim()).join('\n'); break;
    case 'removeEmptyLines': result = splitFormatLines(text).filter((line) => line.trim().length > 0).join('\n'); break;
    case 'removeDuplicateLines': {
      const seen = new Set<string>();
      result = splitFormatLines(text).filter((line) => {
        if (seen.has(line)) return false;
        seen.add(line);
        return true;
      }).join('\n');
      break;
    }
    case 'sortAsc': result = splitFormatLines(text).sort(lineCollator.compare).join('\n'); break;
    case 'sortDesc': result = splitFormatLines(text).sort((left, right) => lineCollator.compare(right, left)).join('\n'); break;
    case 'addLineNumbers': result = splitFormatLines(text).map((line, index) => `${index + 1}. ${line}`).join('\n'); break;
    case 'removeLineNumbers': result = removeSequentialLineNumbers(text); break;
    case 'reverseLines': result = splitFormatLines(text).reverse().join('\n'); break;
    case 'reverseText': result = reverseGraphemes(text); break;
    case 'toHalfWidth': result = toHalfWidth(text); break;
    case 'toFullWidth': result = toFullWidth(text); break;
    default: throw new TextFormatError('invalid_action', `Unsupported text format action: ${action as string}`);
  }
  assertTextFormatOutput(result);
  return result;
}

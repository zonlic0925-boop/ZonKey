// Pure Local Typography, Text Stats & Password Generator

const CJK_REGEX =
  /([\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf])([a-zA-Z0-9$#%&=+\-_*/@])/g
const LATIN_REGEX =
  /([a-zA-Z0-9$#%&=+\-_*/@])([\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf])/g

export function autoPanguSpacing(text: string): string {
  let result = text.replace(CJK_REGEX, '$1 $2')
  result = result.replace(LATIN_REGEX, '$1 $2')
  return result
}

export interface TextStats {
  chars: number
  charsNoSpace: number
  cjkChars: number
  words: number
  lines: number
  paragraphs: number
  readingTimeMinutes: number
}

export function computeTextStats(text: string): TextStats {
  const chars = text.length
  const charsNoSpace = text.replace(/\s/g, '').length
  const cjkChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (text.match(/[a-zA-Z0-9_-]+/g) || []).length + cjkChars
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length
  const paragraphs = text
    .split(/\n+/)
    .filter((p) => p.trim().length > 0).length
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 300))

  return {
    chars,
    charsNoSpace,
    cjkChars,
    words,
    lines,
    paragraphs,
    readingTimeMinutes,
  }
}

export function generateStrongPassword(
  length: number = 16,
  options = { uppercase: true, lowercase: true, numbers: true, symbols: true }
): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const num = '23456789'
  const sym = '!@#$%^&*()-_=+[]{}|;:,.<>?'

  let pool = ''
  if (options.uppercase) pool += upper
  if (options.lowercase) pool += lower
  if (options.numbers) pool += num
  if (options.symbols) pool += sym

  if (!pool) pool = lower + num

  const array = new Uint32Array(length)
  crypto.getRandomValues(array)

  let result = ''
  for (let i = 0; i < length; i++) {
    result += pool[array[i] % pool.length]
  }

  return result
}

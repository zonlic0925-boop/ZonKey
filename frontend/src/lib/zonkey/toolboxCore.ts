/**
 * 第三梯队小工具·纯前端核心（工具箱）。
 *
 * 全部零依赖本地计算，不经后端：文本 diff（LCS 行级）、正则测试、
 * 单位/进制换算、批量重命名规划器。
 */

// ---------------------------------------------------------------------------
// 文本 diff（行级 LCS）
// ---------------------------------------------------------------------------

export type DiffOp = 'equal' | 'insert' | 'delete'

export interface DiffRow {
  op: DiffOp
  leftNo: number | null
  rightNo: number | null
  text: string
}

/**
 * 行级 LCS diff。O(n*m) 动态规划，适合工具场景的中小文本（万行内）。
 * insert=右侧新增行；delete=左侧被删行。
 */
export function diffLines(leftText: string, rightText: string): DiffRow[] {
  // '' 与 'a\nb' 语义约定：单行空文本视为「无内容」，直接算插入/删除，
  // 避免 'a'.split() 产生的 [''] 幽灵行出现在结果里
  const leftEmpty = leftText === ''
  const rightEmpty = rightText === ''
  if (leftEmpty && rightEmpty) return []
  const left = leftEmpty ? [] : leftText.split(/\r\n|\n|\r/)
  const right = rightEmpty ? [] : rightText.split(/\r\n|\n|\r/)
  const n = left.length
  const m = right.length

  // 尾部公共前缀/后缀剪枝，避免大文件全表 DP
  let prefix = 0
  while (prefix < n && prefix < m && left[prefix] === right[prefix]) prefix++
  let suffix = 0
  while (
    suffix < n - prefix &&
    suffix < m - prefix &&
    left[n - 1 - suffix] === right[m - 1 - suffix]
  )
    suffix++

  const midL = left.slice(prefix, n - suffix)
  const midR = right.slice(prefix, m - suffix)

  const rows: DiffRow[] = []
  for (let i = 0; i < prefix; i++)
    rows.push({ op: 'equal', leftNo: i + 1, rightNo: i + 1, text: left[i] })

  const ln = midL.length
  const rn = midR.length
  if (ln && rn) {
    // LCS DP 表（按列滚动会丢路径，这里用全表，万行级可承受）
    const dp: Uint32Array[] = Array.from({ length: ln + 1 }, () => new Uint32Array(rn + 1))
    for (let i = ln - 1; i >= 0; i--) {
      for (let j = rn - 1; j >= 0; j--) {
        dp[i][j] = midL[i] === midR[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
    let i = 0
    let j = 0
    let leftNo = prefix + 1
    let rightNo = prefix + 1
    while (i < ln && j < rn) {
      if (midL[i] === midR[j]) {
        rows.push({ op: 'equal', leftNo: leftNo++, rightNo: rightNo++, text: midL[i] })
        i++
        j++
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        rows.push({ op: 'delete', leftNo: leftNo++, rightNo: null, text: midL[i] })
        i++
      } else {
        rows.push({ op: 'insert', leftNo: null, rightNo: rightNo++, text: midR[j] })
        j++
      }
    }
    while (i < ln) rows.push({ op: 'delete', leftNo: leftNo++, rightNo: null, text: midL[i++] })
    while (j < rn) rows.push({ op: 'insert', leftNo: null, rightNo: rightNo++, text: midR[j++] })
  } else if (ln) {
    midL.forEach((text, k) =>
      rows.push({ op: 'delete', leftNo: prefix + k + 1, rightNo: null, text }),
    )
  } else if (rn) {
    midR.forEach((text, k) =>
      rows.push({ op: 'insert', leftNo: null, rightNo: prefix + k + 1, text }),
    )
  }

  for (let k = 0; k < suffix; k++) {
    const li = n - suffix + k
    const ri = m - suffix + k
    rows.push({ op: 'equal', leftNo: li + 1, rightNo: ri + 1, text: left[li] })
  }
  return rows
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export function diffStats(rows: DiffRow[]): DiffStats {
  let added = 0
  let removed = 0
  let unchanged = 0
  for (const r of rows) {
    if (r.op === 'insert') added++
    else if (r.op === 'delete') removed++
    else unchanged++
  }
  return { added, removed, unchanged }
}

// ---------------------------------------------------------------------------
// 正则测试器
// ---------------------------------------------------------------------------

export interface RegexMatchInfo {
  index: number
  length: number
  text: string
  groups: (string | null)[]
  named: Record<string, string | null>
}

export interface RegexTestResult {
  ok: boolean
  error?: string
  matches: RegexMatchInfo[]
  highlighted: Array<{ text: string; hit: boolean }>
}

/** 正则测试：执行全部匹配（含捕获组），失败返回错误信息。 */
export function testRegex(pattern: string, flags: string, input: string): RegexTestResult {
  const matches: RegexMatchInfo[] = []
  const highlighted: Array<{ text: string; hit: boolean }> = []
  if (!pattern) return { ok: true, matches, highlighted: [{ text: input, hit: false }] }
  let re: RegExp
  try {
    re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
  } catch (err) {
    return { ok: false, error: String((err as Error).message || err), matches, highlighted: [] }
  }
  try {
    let last = 0
    let guard = 0
    while (guard++ < 10000) {
      const m = re.exec(input)
      if (!m) break
      if (m[0] === '' ) {
        // 零宽匹配：推进一位防死循环
        if (m.index < input.length) {
          highlighted.push({ text: input.slice(m.index, m.index + 1), hit: false })
          last = m.index + 1
          re.lastIndex = last
          continue
        }
        break
      }
      highlighted.push({ text: input.slice(last, m.index), hit: false })
      highlighted.push({ text: m[0], hit: true })
      last = m.index + m[0].length
      matches.push({
        index: m.index,
        length: m[0].length,
        text: m[0],
        groups: m.slice(1).map((g) => (g === undefined ? null : g)),
        named: m.groups ? { ...m.groups } : {},
      })
      if (!re.global) break
    }
    highlighted.push({ text: input.slice(last), hit: false })
    return { ok: true, matches, highlighted }
  } catch (err) {
    return { ok: false, error: String((err as Error).message || err), matches, highlighted: [] }
  }
}

// ---------------------------------------------------------------------------
// 单位换算
// ---------------------------------------------------------------------------

/** 换算类别 → 单位表（相对基准单位系数） */
export const UNIT_CATEGORIES = {
  length: {
    base: '米',
    units: {
      km: 1000,
      m: 1,
      dm: 0.1,
      cm: 0.01,
      mm: 0.001,
      um: 1e-6,
      nm: 1e-9,
      mile: 1609.344,
      yard: 0.9144,
      foot: 0.3048,
      inch: 0.0254,
      nmi: 1852,
    },
  },
  weight: {
    base: '千克',
    units: {
      t: 1000,
      kg: 1,
      g: 0.001,
      mg: 1e-6,
      lb: 0.45359237,
      oz: 0.028349523125,
      jin: 0.5, // 市斤
      liang: 0.05, // 市两
    },
  },
  area: {
    base: '平方米',
    units: {
      'km²': 1e6,
      'm²': 1,
      'dm²': 0.01,
      'cm²': 1e-4,
      hectare: 1e4,
      mu: 666.6666666666667, // 亩
      'ft²': 0.09290304,
      'in²': 0.00064516,
      acre: 4046.8564224,
    },
  },
  volume: {
    base: '升',
    units: {
      'm³': 1000,
      L: 1,
      mL: 0.001,
      gal_us: 3.785411784,
      gal_uk: 4.54609,
      qt: 0.946352946,
      cup: 0.2365882365,
      'ft³': 28.316846592,
    },
  },
  speed: {
    base: '米/秒',
    units: {
      'm/s': 1,
      'km/h': 1 / 3.6,
      mph: 0.44704,
      knot: 0.5144444444444445,
      'ft/s': 0.3048,
    },
  },
  data: {
    base: '字节',
    units: {
      bit: 0.125,
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
      PB: 1024 ** 5,
    },
  },
  temperature: {
    base: '摄氏度',
    units: { c: 1, f: 1, k: 1 }, // 特殊处理
  },
  time: {
    base: '秒',
    units: {
      ns: 1e-9,
      us: 1e-6,
      ms: 0.001,
      s: 1,
      min: 60,
      h: 3600,
      day: 86400,
      week: 604800,
      month: 2629746, // 平均月
      year: 31556952, // 平均年
    },
  },
} as const

export type UnitCategory = keyof typeof UNIT_CATEGORIES

export type UnitName = keyof (typeof UNIT_CATEGORIES)[UnitCategory]['units']

export const TEMPERATURE_UNITS = ['c', 'f', 'k'] as const
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number]

/** 单位换算主函数（温度单独处理） */
export function convertUnit(
  category: UnitCategory,
  value: number,
  from: string,
  to: string,
): number {
  if (!Number.isFinite(value)) return NaN
  if (category === 'temperature') return convertTemperature(value, from, to)
  const units = UNIT_CATEGORIES[category].units as Record<string, number>
  const fromFactor = units[from]
  const toFactor = units[to]
  if (fromFactor === undefined || toFactor === undefined) return NaN
  return (value * fromFactor) / toFactor
}

function convertTemperature(value: number, from: string, to: string): number {
  // 统一转到摄氏度
  let c: number
  if (from === 'c') c = value
  else if (from === 'f') c = ((value - 32) * 5) / 9
  else if (from === 'k') c = value - 273.15
  else return NaN
  if (to === 'c') return c
  if (to === 'f') return (c * 9) / 5 + 32
  if (to === 'k') return c + 273.15
  return NaN
}

// ---------------------------------------------------------------------------
// 进制换算
// ---------------------------------------------------------------------------

/** 任意 2-36 进制整数字符串互转（JS Number 安全范围内的精确实现）。 */
export function convertBase(
  input: string,
  fromBase: number,
  toBase: number,
): { ok: boolean; value: string; error?: string } {
  const trimmed = input.trim().replace(/\s+/g, '')
  if (!trimmed) return { ok: false, value: '', error: 'empty' }
  if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36)
    return { ok: false, value: '', error: 'base' }
  let negative = false
  let body = trimmed
  if (body.startsWith('-')) {
    negative = true
    body = body.slice(1)
  } else if (body.startsWith('+')) body = body.slice(1)
  const parsed = parseInt(body, fromBase)
  if (Number.isNaN(parsed)) return { ok: false, value: '', error: 'parse' }
  // 回验：parseInt 对非法尾部宽容（"1A3" in base 2 → 1），需严格校验
  const roundTrip = parsed.toString(fromBase).toLowerCase()
  if (roundTrip !== body.toLowerCase())
    return { ok: false, value: '', error: 'parse' }
  const out = (negative ? '-' : '') + parsed.toString(toBase).toUpperCase()
  return { ok: true, value: out }
}

/** 常用进制同时换算（bin/oct/dec/hex 四联显示） */
export function convertBaseAll(input: string, fromBase: number) {
  const dec = convertBase(input, fromBase, 10)
  if (!dec.ok) return { ok: false as const, error: dec.error }
  return {
    ok: true as const,
    bin: convertBase(input, fromBase, 2).value,
    oct: convertBase(input, fromBase, 8).value,
    dec: dec.value,
    hex: convertBase(input, fromBase, 16).value,
  }
}

// ---------------------------------------------------------------------------
// 批量重命名规划器（纯规划，不执行——文件系统操作由用户在文件管理器确认）
// ---------------------------------------------------------------------------

export interface RenameItem {
  name: string
  newName: string
  conflict: boolean
  unchanged: boolean
}

export interface RenameOptions {
  pattern: string // 查找（支持正则开关）
  replacement: string // 替换（支持 $1 捕获组）
  useRegex: boolean
  caseSensitive: boolean
  prefix: string
  suffix: string
  startNumber: number // 序号起始（>0 时启用序号）
  padding: number // 序号位数
  keepExtension: boolean // 保留扩展名（替换只作用于主名）
}

export const DEFAULT_RENAME_OPTIONS: RenameOptions = {
  pattern: '',
  replacement: '',
  useRegex: false,
  caseSensitive: true,
  prefix: '',
  suffix: '',
  startNumber: 0,
  padding: 3,
  keepExtension: true,
}

function splitName(name: string, keepExtension: boolean): { stem: string; ext: string } {
  if (!keepExtension) return { stem: name, ext: '' }
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { stem: name, ext: '' }
  return { stem: name.slice(0, dot), ext: name.slice(dot) }
}

/** 规划批量重命名：不触碰文件系统，冲突（重名/空名/非法字符）就地标注。 */
export function planRename(files: string[], opts: RenameOptions): RenameItem[] {
  let re: RegExp | null = null
  if (opts.pattern) {
    try {
      re = new RegExp(
        opts.pattern,
        `${opts.caseSensitive ? '' : 'i'}${opts.useRegex ? '' : 'g'}`,
      )
      if (!opts.useRegex) {
        // 字面量模式转义后按全局替换
        re = new RegExp(
          opts.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          `${opts.caseSensitive ? '' : 'i'}g`,
        )
      }
    } catch {
      re = null
    }
  }

  const seen = new Map<string, number>()
  const results: RenameItem[] = []
  files.forEach((name, index) => {
    const { stem, ext } = splitName(name, opts.keepExtension)
    let newStem = stem
    if (re) newStem = newStem.replace(re, opts.replacement)
    if (opts.prefix) newStem = opts.prefix + newStem
    if (opts.suffix) newStem += opts.suffix
    if (opts.startNumber > 0) {
      const num = String(opts.startNumber + index).padStart(opts.padding, '0')
      newStem = `${newStem}${num}`
    }
    const newName = `${newStem}${ext}`
    const invalid = /[\\/:*?"<>|]/.test(newName) || newName.trim() === ''
    const count = seen.get(newName) ?? 0
    seen.set(newName, count + 1)
    results.push({
      name,
      newName,
      // 冲突=重名或非法字符；「未变化」不是冲突，只标注 unchanged
      conflict: invalid || count > 0,
      unchanged: newName === name,
    })
  })
  return results
}

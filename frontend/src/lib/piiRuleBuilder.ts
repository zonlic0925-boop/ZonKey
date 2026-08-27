export type PiiMatchMode = 'contains' | 'prefix_digits' | 'digit_length' | 'advanced'

export interface SimplePiiRuleInput {
  name: string
  category: string
  mode: PiiMatchMode
  keyword?: string
  prefix?: string
  digitLength?: number
  advancedPattern?: string
}

export const PII_MATCH_MODE_LABELS: Record<PiiMatchMode, string> = {
  contains: '包含指定文字',
  prefix_digits: '固定前缀 + 数字',
  digit_length: '连续数字',
  advanced: '高级自定义',
}

export const PII_MATCH_MODE_HINTS: Record<PiiMatchMode, string> = {
  contains: '文档里出现这段文字就会被标记，适合公司名、项目代号、固定短语',
  prefix_digits: '适合合同编号 HT-001、工号 EMP2024001 等「文字+数字」格式',
  digit_length: '适合固定长度的编号，如 6 位工号、8 位验证码',
  advanced: '仅建议在熟悉匹配语法时使用',
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function validateRegexPattern(pattern: string): string | null {
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern)
    return null
  } catch (err: unknown) {
    return err instanceof Error ? err.message : '匹配规则格式无效'
  }
}

export function buildPiiPattern(input: SimplePiiRuleInput): { pattern: string; description: string; match_mode: PiiMatchMode } {
  switch (input.mode) {
    case 'contains': {
      const keyword = input.keyword?.trim()
      if (!keyword) throw new Error('请输入要查找的文字')
      return {
        pattern: escapeRegex(keyword),
        description: `包含「${keyword}」`,
        match_mode: 'contains',
      }
    }
    case 'prefix_digits': {
      const prefix = input.prefix?.trim()
      if (!prefix) throw new Error('请输入前缀文字')
      const len = input.digitLength
      const digitPart = len && len > 0 ? `\\d{${len}}` : '\\d+'
      return {
        pattern: `${escapeRegex(prefix)}${digitPart}`,
        description:
          len && len > 0 ? `以「${prefix}」开头 + ${len} 位数字` : `以「${prefix}」开头 + 数字`,
        match_mode: 'prefix_digits',
      }
    }
    case 'digit_length': {
      const len = input.digitLength
      if (!len || len < 1 || len > 32) throw new Error('请输入 1–32 之间的数字位数')
      return {
        pattern: `(?<!\\d)\\d{${len}}(?!\\d)`,
        description: `连续 ${len} 位数字`,
        match_mode: 'digit_length',
      }
    }
    case 'advanced': {
      const pattern = input.advancedPattern?.trim()
      if (!pattern) throw new Error('请输入高级匹配规则')
      const err = validateRegexPattern(pattern)
      if (err) throw new Error(`高级规则无效：${err}`)
      return {
        pattern,
        description: '高级自定义规则',
        match_mode: 'advanced',
      }
    }
    default:
      throw new Error('未知匹配方式')
  }
}

export function previewPiiRule(input: SimplePiiRuleInput): string {
  try {
    return buildPiiPattern(input).description
  } catch (err: unknown) {
    return err instanceof Error ? err.message : '请完善规则信息'
  }
}

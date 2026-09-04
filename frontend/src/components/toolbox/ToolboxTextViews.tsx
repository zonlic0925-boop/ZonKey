/**
 * 工具箱·文本类小工具视图（纯前端，零后端依赖）：
 * 文本 Diff / 正则测试 / 单位换算 / 进制换算 / 批量重命名规划器。
 */
import React, { useMemo, useState } from 'react'
import {
  FileDiff,
  Regex,
  Ruler,
  Binary,
  FileInput,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  AreaInput,
  CopyButton,
  ErrorLine,
  Field,
  NumInput,
  ResultTile,
  inputClass,
} from '../calcdev/kit'
import {
  DEFAULT_RENAME_OPTIONS,
  UNIT_CATEGORIES,
  convertBaseAll,
  convertUnit,
  diffLines,
  diffStats,
  planRename,
  testRegex,
} from '../../lib/zonkey/toolboxCore'
import type { RenameOptions, UnitCategory } from '../../lib/zonkey/toolboxCore'

const selectClass = `${inputClass} appearance-none`

// ---------------------------------------------------------------------------
// 文本 Diff
// ---------------------------------------------------------------------------

export const DiffView: React.FC = () => {
  const { t } = useI18n()
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const rows = useMemo(() => diffLines(left, right), [left, right])
  const stats = useMemo(() => diffStats(rows), [rows])
  const showDiff = left !== '' || right !== ''

  const opClass: Record<string, string> = {
    equal: 'bg-white text-mem-ink/70',
    delete: 'bg-mem-coral/15 text-mem-coral',
    insert: 'bg-mem-teal/15 text-mem-teal',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileDiff className="w-5 h-5 text-mem-pink" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.textDiff')}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={t('toolbox.diffOriginal')}>
          <AreaInput value={left} onChange={setLeft} rows={8} placeholder={t('toolbox.diffOriginalHint')} />
        </Field>
        <Field label={t('toolbox.diffModified')}>
          <AreaInput value={right} onChange={setRight} rows={8} placeholder={t('toolbox.diffModifiedHint')} />
        </Field>
      </div>
      {showDiff && (
        <>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            <ResultTile value={stats.added} label={t('toolbox.diffAdded')} tone="teal" />
            <ResultTile value={stats.removed} label={t('toolbox.diffRemoved')} tone="coral" />
            <ResultTile value={stats.unchanged} label={t('toolbox.diffUnchanged')} tone="sky" />
          </div>
          <div className="border-2 border-mem-ink rounded-xl overflow-hidden bg-white">
            <div className="max-h-96 overflow-auto font-mono text-xs leading-5">
              {rows.map((row, i) => (
                <div key={i} className={`flex ${opClass[row.op]} border-b border-mem-ink/5`}>
                  <span className="w-10 shrink-0 px-1 text-right text-mem-ink/30 select-none">{row.leftNo ?? ''}</span>
                  <span className="w-10 shrink-0 px-1 text-right text-mem-ink/30 select-none">{row.rightNo ?? ''}</span>
                  <span className="w-5 shrink-0 text-center select-none font-bold">
                    {row.op === 'delete' ? '−' : row.op === 'insert' ? '+' : ' '}
                  </span>
                  <span className="px-1 whitespace-pre-wrap break-all min-w-0">{row.text || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 正则测试器
// ---------------------------------------------------------------------------

const REGEX_FLAG_DEFS: Array<{ flag: string; key: string }> = [
  { flag: 'g', key: 'toolbox.regexFlagGlobal' },
  { flag: 'i', key: 'toolbox.regexFlagIgnoreCase' },
  { flag: 'm', key: 'toolbox.regexFlagMultiline' },
  { flag: 's', key: 'toolbox.regexFlagDotAll' },
]

export const RegexTesterView: React.FC = () => {
  const { t } = useI18n()
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [input, setInput] = useState('')
  const result = useMemo(() => testRegex(pattern, flags, input), [pattern, flags, input])

  const toggleFlag = (flag: string) => {
    setFlags((prev) => (prev.includes(flag) ? prev.replace(flag, '') : prev + flag))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Regex className="w-5 h-5 text-mem-lavender" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.regexTester')}</h3>
      </div>
      <Field label={t('toolbox.regexPattern')}>
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder={t('toolbox.regexPatternHint')}
          className={`${inputClass} font-mono`}
          spellCheck={false}
        />
      </Field>
      <div className="flex gap-1.5 flex-wrap">
        {REGEX_FLAG_DEFS.map(({ flag, key }) => (
          <MemphisButton
            key={flag}
            size="sm"
            variant={flags.includes(flag) ? 'lavender' : 'white'}
            onClick={() => toggleFlag(flag)}
          >
            /{flag}/ {t(key)}
          </MemphisButton>
        ))}
      </div>
      <Field label={t('toolbox.regexInput')}>
        <AreaInput value={input} onChange={setInput} rows={6} placeholder={t('toolbox.regexInputHint')} />
      </Field>
      <ErrorLine message={result.ok ? null : result.error} />
      {result.ok && input && (
        <>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            <ResultTile value={result.matches.length} label={t('toolbox.regexMatchCount')} tone="lavender" />
          </div>
          {result.highlighted.length > 0 && (
            <div className="border-2 border-mem-ink rounded-xl bg-white p-3 font-mono text-xs leading-6 whitespace-pre-wrap break-all max-h-72 overflow-auto">
              {result.highlighted.map((seg, i) =>
                seg.hit ? (
                  <mark key={i} className="bg-mem-yellow/70 text-mem-ink rounded px-0.5">{seg.text}</mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </div>
          )}
          {result.matches.length > 0 && (
            <div className="space-y-1.5">
              {result.matches.slice(0, 50).map((m, i) => (
                <div key={i} className="px-3 py-2 bg-white border-2 border-mem-ink/20 rounded-xl text-xs font-mono">
                  <span className="font-bold text-mem-lavender">#{i + 1}</span>{' '}
                  <span className="font-bold">{m.text}</span>
                  {m.groups.map((g, gi) => (
                    <span key={gi} className="ml-2 text-mem-ink/60">
                      ${gi + 1}=<span className="text-mem-teal font-bold">{g === null ? 'null' : g}</span>
                    </span>
                  ))}
                  {Object.entries(m.named).map(([name, val]) => (
                    <span key={name} className="ml-2 text-mem-ink/60">
                      {name}=<span className="text-mem-sky font-bold">{val === null ? 'null' : val}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 单位换算
// ---------------------------------------------------------------------------

const UNIT_LABELS: Record<string, Record<string, string>> = {
  length: {
    km: 'km 千米', m: 'm 米', dm: 'dm 分米', cm: 'cm 厘米', mm: 'mm 毫米',
    um: 'μm 微米', nm: 'nm 纳米', mile: 'mi 英里', yard: 'yd 码', foot: 'ft 英尺',
    inch: 'in 英寸', nmi: 'nmi 海里',
  },
  weight: { t: 't 吨', kg: 'kg 千克', g: 'g 克', mg: 'mg 毫克', lb: 'lb 磅', oz: 'oz 盎司', jin: '市斤', liang: '市两' },
  area: { 'km²': 'km²', 'm²': 'm²', 'dm²': 'dm²', 'cm²': 'cm²', hectare: '公顷', mu: '亩', 'ft²': 'ft²', 'in²': 'in²', acre: '英亩' },
  volume: { 'm³': 'm³', L: 'L 升', mL: 'mL 毫升', gal_us: '美制加仑', gal_uk: '英制加仑', qt: '夸脱', cup: '杯', 'ft³': 'ft³' },
  speed: { 'm/s': 'm/s', 'km/h': 'km/h', mph: 'mph', knot: '节', 'ft/s': 'ft/s' },
  data: { bit: 'bit', B: 'B', KB: 'KB', MB: 'MB', GB: 'GB', TB: 'TB', PB: 'PB' },
  temperature: { c: '°C 摄氏', f: '°F 华氏', k: 'K 开尔文' },
  time: { ns: '纳秒', us: '微秒', ms: '毫秒', s: '秒', min: '分钟', h: '小时', day: '天', week: '周', month: '月', year: '年' },
}

export const UnitConverterView: React.FC = () => {
  const { t, locale } = useI18n()
  const [category, setCategory] = useState<UnitCategory>('length')
  const [value, setValue] = useState(1)
  const units = UNIT_CATEGORIES[category].units as Record<string, number>
  const unitNames = Object.keys(units)
  const [from, setFrom] = useState(unitNames[0])
  const [to, setTo] = useState(unitNames[1] ?? unitNames[0])

  const switchCategory = (cat: UnitCategory) => {
    setCategory(cat)
    const names = Object.keys(UNIT_CATEGORIES[cat].units as Record<string, number>)
    setFrom(names[0])
    setTo(names[1] ?? names[0])
  }

  const output = convertUnit(category, value, from, to)
  const fmt = (v: number) =>
    Number.isFinite(v)
      ? Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v !== 0)
        ? v.toExponential(6)
        : parseFloat(v.toPrecision(10)).toString()
      : '—'

  const categoryLabel = (cat: UnitCategory) => t(`toolbox.unitCat_${cat}`)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Ruler className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.unitConverter')}</h3>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(UNIT_CATEGORIES) as UnitCategory[]).map((cat) => (
          <MemphisButton
            key={cat}
            size="sm"
            variant={category === cat ? 'sky' : 'white'}
            onClick={() => switchCategory(cat)}
          >
            {categoryLabel(cat)}
          </MemphisButton>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <Field label={t('toolbox.unitFrom')}>
          <NumInput value={value} onChange={setValue} step="any" />
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={`${selectClass} mt-1.5`}>
            {unitNames.map((u) => (
              <option key={u} value={u}>{UNIT_LABELS[category]?.[u] ?? u}</option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          onClick={() => { setFrom(to); setTo(from) }}
          className="hidden md:flex w-9 h-9 mb-1 items-center justify-center rounded-xl border-2 border-mem-ink bg-white hover:bg-mem-yellow/40"
          title={t('toolbox.unitSwap')}
        >
          ⇄
        </button>
        <Field label={t('toolbox.unitTo')}>
          <div className={`${inputClass} bg-mem-cream font-bold`}>{fmt(output)}</div>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={`${selectClass} mt-1.5`}>
            {unitNames.map((u) => (
              <option key={u} value={u}>{UNIT_LABELS[category]?.[u] ?? u}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="text-xs text-mem-ink/50 font-medium">
        {locale === 'zh-CN' ? '全部本地换算，常数遵循国际计量标准（亩=666.67㎡、数据=1024 进制）。' : 'All conversions computed locally. SI constants; data units use binary (1024) prefixes.'}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 进制换算
// ---------------------------------------------------------------------------

const BASE_DEFS: Array<{ base: number; label: string; prefix: string }> = [
  { base: 2, label: 'BIN (2)', prefix: '0b' },
  { base: 8, label: 'OCT (8)', prefix: '0o' },
  { base: 10, label: 'DEC (10)', prefix: '' },
  { base: 16, label: 'HEX (16)', prefix: '0x' },
]

export const BaseConverterView: React.FC = () => {
  const { t } = useI18n()
  const [fromBase, setFromBase] = useState(10)
  const [input, setInput] = useState('255')
  const result = useMemo(() => convertBaseAll(input, fromBase), [input, fromBase])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Binary className="w-5 h-5 text-mem-teal" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.baseConverter')}</h3>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {BASE_DEFS.map(({ base, label }) => (
          <MemphisButton
            key={base}
            size="sm"
            variant={fromBase === base ? 'teal' : 'white'}
            onClick={() => setFromBase(base)}
          >
            {label}
          </MemphisButton>
        ))}
      </div>
      <Field label={t('toolbox.baseInput', { base: fromBase })}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`${inputClass} font-mono text-sm`}
          spellCheck={false}
          placeholder={fromBase === 16 ? 'FF / 0xFF' : '255'}
        />
      </Field>
      <ErrorLine message={!result.ok && input.trim() ? t('toolbox.baseInvalid') : null} />
      {result.ok && (
        <div className="space-y-2">
          {BASE_DEFS.map(({ base, prefix }) => {
            const val = base === 2 ? result.bin : base === 8 ? result.oct : base === 10 ? result.dec : result.hex
            return (
              <div key={base} className="flex items-center justify-between gap-3 px-3 py-2 bg-white border-2 border-mem-ink rounded-xl">
                <span className="text-xs font-black text-mem-ink/60 w-20 shrink-0">{prefix || t('toolbox.baseDec')} {base===10?'':base}</span>
                <span className="font-mono font-bold text-sm break-all min-w-0 text-right">{val}</span>
                <CopyButton text={val} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 批量重命名规划器
// ---------------------------------------------------------------------------

export const BatchRenameView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<string[]>([])
  const [opts, setOpts] = useState<RenameOptions>(DEFAULT_RENAME_OPTIONS)

  const plan = useMemo(
    () => (files.length ? planRename(files, opts) : []),
    [files, opts],
  )
  const conflictCount = plan.filter((p) => p.conflict).length
  const changedCount = plan.filter((p) => !p.unchanged).length

  const readFiles = async (list: FileList | null) => {
    if (!list) return
    setFiles(Array.from(list).map((f) => f.name))
  }

  const set = <K extends keyof RenameOptions>(key: K, value: RenameOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }))

  const exportPlan = () => {
    const lines = plan.map((p) => `${p.name}\t→\t${p.newName}${p.conflict ? `\t[!]` : ''}`)
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rename_plan.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileInput className="w-5 h-5 text-mem-orange" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.batchRename')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('toolbox.renameIntro')}</p>

      <Field label={t('toolbox.renamePick')}>
        <input
          type="file"
          multiple
          onChange={(e) => { readFiles(e.target.files); e.target.value = '' }}
          className="text-xs"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={t('toolbox.renameFind')}>
          <input value={opts.pattern} onChange={(e) => set('pattern', e.target.value)} className={inputClass} spellCheck={false} />
        </Field>
        <Field label={t('toolbox.renameReplace')}>
          <input value={opts.replacement} onChange={(e) => set('replacement', e.target.value)} className={inputClass} spellCheck={false} />
        </Field>
        <Field label={t('toolbox.renamePrefix')}>
          <input value={opts.prefix} onChange={(e) => set('prefix', e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('toolbox.renameSuffix')}>
          <input value={opts.suffix} onChange={(e) => set('suffix', e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('toolbox.renameStartNum')}>
          <NumInput value={opts.startNumber} onChange={(v) => set('startNumber', Number.isNaN(v) ? 0 : Math.max(0, Math.floor(v)))} />
        </Field>
        <Field label={t('toolbox.renamePadding')}>
          <NumInput value={opts.padding} onChange={(v) => set('padding', Number.isNaN(v) ? 3 : Math.min(8, Math.max(1, Math.floor(v))))} />
        </Field>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <MemphisButton size="sm" variant={opts.useRegex ? 'orange' : 'white'} onClick={() => set('useRegex', !opts.useRegex)}>
          {t('toolbox.renameUseRegex')}
        </MemphisButton>
        <MemphisButton size="sm" variant={!opts.caseSensitive ? 'orange' : 'white'} onClick={() => set('caseSensitive', !opts.caseSensitive)}>
          {t('toolbox.renameIgnoreCase')}
        </MemphisButton>
        <MemphisButton size="sm" variant={opts.keepExtension ? 'teal' : 'white'} onClick={() => set('keepExtension', !opts.keepExtension)}>
          {t('toolbox.renameKeepExt')}
        </MemphisButton>
      </div>

      {plan.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            <ResultTile value={plan.length} label={t('toolbox.renameTotal')} tone="sky" />
            <ResultTile value={changedCount} label={t('toolbox.renameChanged')} tone="yellow" />
            <ResultTile value={conflictCount} label={t('toolbox.renameConflicts')} tone={conflictCount ? 'coral' : 'teal'} />
          </div>
          <div className="border-2 border-mem-ink rounded-xl overflow-hidden bg-white">
            <div className="max-h-80 overflow-auto divide-y divide-mem-ink/5 text-xs font-mono">
              {plan.map((p, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                  <span className={`truncate min-w-0 flex-1 ${p.unchanged ? 'text-mem-ink/40' : 'text-mem-ink'}`}>{p.name}</span>
                  <span className="text-mem-ink/40 shrink-0">→</span>
                  <span className={`truncate min-w-0 flex-1 font-bold ${p.conflict ? 'text-mem-coral' : p.unchanged ? 'text-mem-ink/40' : 'text-mem-teal'}`}>{p.newName}</span>
                  {p.conflict && <span className="shrink-0 px-1.5 rounded border border-mem-coral text-mem-coral font-bold">!</span>}
                </div>
              ))}
            </div>
          </div>
          <MemphisButton variant="orange" onClick={exportPlan}>{t('toolbox.renameExport')}</MemphisButton>
        </>
      )}
    </div>
  )
}

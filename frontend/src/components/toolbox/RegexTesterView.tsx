import React, { useMemo, useState } from 'react'
import { Regex } from 'lucide-react'
import { useI18n } from '../../i18n'
import { ErrorLine, Field, inputClass, ResultTile } from '../calcdev/kit'
import { testRegex } from '../../lib/zonkey/toolboxCore'
import { copyTextToClipboard } from '../../lib/deliver'
import { CopyButton } from '../calcdev/kit'

export const RegexTesterView: React.FC = () => {
  const { t } = useI18n()
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [input, setInput] = useState('')
  const [caseInsensitive, setCaseInsensitive] = useState(false)
  const [multiline, setMultiline] = useState(false)

  const effectiveFlags = `${caseInsensitive ? 'i' : ''}${multiline ? 'm' : ''}${flags.includes('g') ? '' : 'g'}`
  const result = useMemo(() => testRegex(pattern, effectiveFlags, input), [pattern, effectiveFlags, input])
  const total = result.matches.reduce((n, m) => n + m.length, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Regex className="w-5 h-5 text-mem-lavender" />
        <h3 className="font-display font-black text-mem-ink">{t('toolbox.regexTitle')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('toolbox.regexHint')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={t('toolbox.regexPattern')}>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className={`${inputClass} font-mono`}
            placeholder={t('toolbox.regexPatternPh')}
            spellCheck={false}
          />
        </Field>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-1.5 text-xs font-bold text-mem-ink/70 pb-2 cursor-pointer">
            <input type="checkbox" checked={caseInsensitive} onChange={(e) => setCaseInsensitive(e.target.checked)} />
            i {t('toolbox.regexIgnoreCase')}
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-mem-ink/70 pb-2 cursor-pointer">
            <input type="checkbox" checked={multiline} onChange={(e) => setMultiline(e.target.checked)} />
            m {t('toolbox.regexMultiline')}
          </label>
        </div>
      </div>

      <Field label={t('toolbox.regexTestText')}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={7}
          className={`${inputClass} resize-y font-mono`}
          placeholder={t('toolbox.regexTextPh')}
          spellCheck={false}
        />
      </Field>

      {pattern && input && (
        <>
          <div className="grid grid-cols-2 gap-2 max-w-sm">
            <ResultTile value={result.matches.length} label={t('toolbox.regexMatches')} tone="lavender" />
            <ResultTile value={total} label={t('toolbox.regexChars')} tone="sky" />
          </div>

          <ErrorLine message={result.ok ? null : (result.error ? t('toolbox.regexError') + '：' + result.error : null)} />

          {result.ok && (
            <div className="border-2 border-mem-ink rounded-xl p-3 bg-white max-h-64 overflow-y-auto">
              <p className="text-xs font-bold text-mem-ink/60 mb-2">{t('toolbox.regexPreview')}</p>
              {highlightText(input, result.highlighted)}
              {result.matches.length === 0 && (
                <p className="text-xs text-mem-ink/40 font-medium">{t('toolbox.regexNoMatch')}</p>
              )}
            </div>
          )}

          {result.ok && result.matches.length > 0 && (
            <div className="border-2 border-mem-ink rounded-xl overflow-hidden bg-white max-h-56 overflow-y-auto">
              {result.matches.map((m, i) => (
                <div key={i} className="px-3 py-1.5 border-b border-mem-ink/10 text-xs font-mono last:border-b-0">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-mem-lavender/30 border border-mem-ink/20 mr-2 font-black text-mem-ink">
                    #{i + 1}
                  </span>
                  <span className="text-mem-ink/60 mr-2">{t('toolbox.regexAt')} {m.index}</span>
                  <span className="text-mem-ink">"{m.text}"</span>
                  {m.groups.some((g) => g !== null) && (
                    <span className="block mt-1 text-mem-ink/60">
                      {m.groups.map((g, gi) => (
                        <span key={gi} className="mr-3">
                          <b className="text-mem-ink">${gi + 1}</b>={g === null ? t('toolbox.regexNoGroup') : `"${g}"`}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.ok && result.matches.length > 0 && (
            <CopyButton text={result.matches.map((m, i) => `#${i + 1} @${m.index}: ${m.text}`).join('\n')} />
          )}
        </>
      )}
    </div>
  )
}

function highlightText(
  input: string,
  highlighted: Array<{ text: string; hit: boolean }>,
): React.ReactNode {
  if (highlighted.length === 0) return <span className="text-xs whitespace-pre-wrap font-mono break-all">{input}</span>
  return (
    <span className="text-xs whitespace-pre-wrap font-mono break-all">
      {highlighted.map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="bg-mem-yellow/70 text-mem-ink rounded-sm px-0.5 font-bold">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  )
}

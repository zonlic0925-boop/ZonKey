import React, { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useI18n } from '../../i18n'
import { calculateTextStats } from '../../lib/toolknit/textStatsCore'
import { AreaInput, ResultTile } from '../calcdev/kit'

export const TextStatsView: React.FC = () => {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const stats = useMemo(() => {
    try {
      return calculateTextStats(text)
    } catch {
      return null
    }
  }, [text])

  const minutes = (n: number) => (n === 0 ? '—' : `${n} min`)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-5 h-5 text-mem-teal" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.textStats')}</h3>
      </div>

      <AreaInput value={text} onChange={setText} rows={8} placeholder={t('textcenter.statsPlaceholder')} />

      {stats && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <ResultTile value={stats.chars.toLocaleString()} label={t('textcenter.chars')} tone="teal" />
            <ResultTile value={stats.words.toLocaleString()} label={t('textcenter.words')} tone="sky" />
            <ResultTile value={stats.chineseChars.toLocaleString()} label={t('textcenter.chineseChars')} tone="coral" />
            <ResultTile value={stats.englishWords.toLocaleString()} label={t('textcenter.englishWords')} tone="lavender" />
            <ResultTile value={stats.sentences.toLocaleString()} label={t('textcenter.sentences')} tone="yellow" />
            <ResultTile value={stats.paragraphs.toLocaleString()} label={t('textcenter.paragraphs')} tone="lime" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ResultTile value={stats.lines.toLocaleString()} label={t('textcenter.lines')} tone="sky" />
            <ResultTile value={stats.punctuation.toLocaleString()} label={t('textcenter.punctuation')} tone="yellow" />
            <ResultTile value={minutes(stats.readingTime)} label={t('textcenter.readingTime')} tone="teal" />
            <ResultTile value={minutes(stats.speakingTime)} label={t('textcenter.speakingTime')} tone="coral" />
            <ResultTile value={`${stats.lexicalDensity}%`} label={t('textcenter.lexicalDensity')} tone="lavender" />
          </div>

          {(stats.topChineseChars.length > 0 || stats.topWords.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stats.topChineseChars.length > 0 && (
                <div className="p-3 bg-white border-2 border-mem-ink rounded-2xl">
                  <p className="text-[11px] font-bold text-mem-ink/60 mb-2">{t('textcenter.topChineseChars')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.topChineseChars.map((item) => (
                      <span key={item.text} className="px-2 py-0.5 text-xs font-bold border-2 border-mem-ink rounded-lg bg-mem-coral/10">
                        {item.text} × {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {stats.topWords.length > 0 && (
                <div className="p-3 bg-white border-2 border-mem-ink rounded-2xl">
                  <p className="text-[11px] font-bold text-mem-ink/60 mb-2">{t('textcenter.topWords')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.topWords.map((item) => (
                      <span key={item.text} className="px-2 py-0.5 text-xs font-bold border-2 border-mem-ink rounded-lg bg-mem-sky/10">
                        {item.text} × {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

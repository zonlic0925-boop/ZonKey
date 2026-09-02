import React, { useState } from 'react'
import { ListTree, Presentation } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  PPT_OUTLINE_DECK_TYPES,
  PPT_OUTLINE_LIMITS,
  createPptOutlineMarkdown,
  generatePptOutline,
  parsePptOutlineMarkdown,
  type PptOutline,
  type PptOutlineDeckType,
} from '../../lib/zonkey/pptOutlineCore'
import { buildPptDraftPptx, PPT_DRAFT_THEMES } from '../../lib/zonkey/pptDraftCore'
import { downloadBytes } from '../pdfcenter/pdfKit'
import { downloadBlob } from '../imagecenter/imageKit'
import { ErrorLine } from '../calcdev/kit'

const DECK_TYPE_I18N_KEYS: Record<PptOutlineDeckType, string> = {
  auto: 'pptcenter.typeAuto',
  'product-launch': 'pptcenter.typeProductLaunch',
  'investor-pitch': 'pptcenter.typeInvestorPitch',
  'work-report': 'pptcenter.typeWorkReport',
  training: 'pptcenter.typeTraining',
  'industry-research': 'pptcenter.typeIndustryResearch',
  'competitive-analysis': 'pptcenter.typeCompetitiveAnalysis',
  'short-video-demo': 'pptcenter.typeShortVideoDemo',
  'project-review': 'pptcenter.typeProjectReview',
}

const SAMPLE_OUTLINE = `# 示例：产品介绍（产品发布）

## 背景与现状
- 目标用户与使用场景
- 当前方案的痛点

## 核心能力
- 功能一：一句话说明
- 功能二：一句话说明

## 总结
- 关键收益回顾
- Q & A
`

export const PptOutlineView: React.FC = () => {
  const { t, locale } = useI18n()
  const [topic, setTopic] = useState('')
  const [deckType, setDeckType] = useState<PptOutlineDeckType>('auto')
  const [slideCount, setSlideCount] = useState(10)
  const [outline, setOutline] = useState<PptOutline | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    setError(null)
    try {
      const result = generatePptOutline({
        topic,
        deckType,
        locale: locale === 'en' ? 'en' : 'zh-CN',
        slideCount,
      })
      setOutline(result)
      setMarkdown(createPptOutlineMarkdown(result))
    } catch (err) {
      setError(String((err as Error).message))
    }
  }

  const downloadMd = () => {
    downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), 'outline.md')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ListTree className="w-5 h-5 text-mem-orange" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pptOutline')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pptcenter.outlineHint')}</p>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-mem-ink/70">{t('pptcenter.outlineTopic')}</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('pptcenter.outlineTopicPh')}
          maxLength={PPT_OUTLINE_LIMITS.maxTopicChars}
          className="w-full px-3 py-2 text-sm bg-white border-2 border-mem-ink rounded-xl font-medium focus:outline-none"
        />
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="block text-xs font-bold text-mem-ink/70">{t('pptcenter.outlineDeckType')}</label>
          <select
            value={deckType}
            onChange={(e) => setDeckType(e.target.value as PptOutlineDeckType)}
            className="px-3 py-2 text-xs font-bold bg-white border-2 border-mem-ink rounded-xl focus:outline-none"
          >
            {PPT_OUTLINE_DECK_TYPES.map((value) => (
              <option key={value} value={value}>{t(DECK_TYPE_I18N_KEYS[value])}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-bold text-mem-ink/70">{t('pptcenter.outlineSlideCount')}</label>
          <input
            type="number"
            min={PPT_OUTLINE_LIMITS.minSlides}
            max={PPT_OUTLINE_LIMITS.maxSlides}
            value={slideCount}
            onChange={(e) => setSlideCount(Number(e.target.value) || 10)}
            className="w-24 px-3 py-2 text-xs font-bold bg-white border-2 border-mem-ink rounded-xl focus:outline-none"
          />
        </div>
        <MemphisButton variant="orange" onClick={run} disabled={!topic.trim()}>
          {t('pptcenter.outlineGenerate')}
        </MemphisButton>
      </div>

      <ErrorLine message={error} />

      {outline && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-bold text-mem-ink/70">
              {t('pptcenter.outlineDone', { count: outline.slides.length })}
            </p>
            <MemphisButton size="sm" variant="teal" onClick={downloadMd}>
              {t('pptcenter.outlineDownload')}
            </MemphisButton>
          </div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            spellCheck={false}
            className="w-full h-72 px-3 py-2 text-xs font-mono bg-white border-2 border-mem-ink rounded-xl focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}

export const PptDraftView: React.FC = () => {
  const { t } = useI18n()
  const [markdown, setMarkdown] = useState('')
  const [themeId, setThemeId] = useState<keyof typeof PPT_DRAFT_THEMES>('minimal-mono')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const deck = parsePptOutlineMarkdown(markdown)
      const output = await buildPptDraftPptx(deck, themeId)
      downloadBytes(output.bytes, output.fileName, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
      setDone(output.slideCount)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Presentation className="w-5 h-5 text-mem-orange" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pptDraft')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pptcenter.draftHint')}</p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.values(PPT_DRAFT_THEMES).map((theme) => (
          <MemphisButton key={theme.id} size="sm" variant={themeId === theme.id ? 'orange' : 'white'} onClick={() => setThemeId(theme.id)}>
            {theme.name}
          </MemphisButton>
        ))}
        <MemphisButton size="sm" variant="white" onClick={() => setMarkdown(SAMPLE_OUTLINE)}>
          {t('pptcenter.draftSample')}
        </MemphisButton>
      </div>

      <textarea
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        placeholder={SAMPLE_OUTLINE}
        spellCheck={false}
        className="w-full h-72 px-3 py-2 text-xs font-mono bg-white border-2 border-mem-ink rounded-xl focus:outline-none"
      />

      <MemphisButton variant="orange" onClick={run} disabled={busy || !markdown.trim()}>
        {t('pptcenter.draftNow')}
      </MemphisButton>
      {busy && <p className="text-xs font-bold text-mem-orange animate-pulse">{t('pdfcenter.processing')}</p>}
      {done !== null && <p className="text-xs font-bold text-mem-teal">{t('pptcenter.draftDone', { count: done })}</p>}
      <ErrorLine message={error} />
    </div>
  )
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  computeTypingStats,
  generateTypingText,
  getTypingRating,
  normalizeTypingValue,
  TYPING_DURATIONS,
  type TypingDifficulty,
  type TypingLang,
} from '../../lib/zonkey/typingCore'

type Phase = 'settings' | 'running' | 'result'

interface ResultSnapshot {
  wpm: number
  cpm: number
  accuracy: number
  correct: number
  wrong: number
  rating: string
}

/** 打字测速：中英文双语词库、四档难度、IME 兼容、实时 WPM */
export const TypingTestView: React.FC = () => {
  const { t, locale } = useI18n()
  const [phase, setPhase] = useState<Phase>('settings')
  const [lang, setLang] = useState<TypingLang>(locale === 'en' ? 'en' : 'zh')
  const [difficulty, setDifficulty] = useState<TypingDifficulty>('easy')
  const [duration, setDuration] = useState<number>(30)

  const [targetText, setTargetText] = useState('')
  const [input, setInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(30)
  const [result, setResult] = useState<ResultSnapshot | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const stateRef = useRef({
    startTime: 0,
    isRunning: false,
    isFinished: false,
    composing: false,
    zhBuffer: '',
    finishedTimer: null as ReturnType<typeof setInterval> | null,
  })

  const normalizedTarget = useMemo(() => normalizeTypingValue(targetText), [targetText])
  const normalizedInput = useMemo(() => normalizeTypingValue(input), [input])

  const live = useMemo(
    () => computeTypingStats(targetText, input, stateRef.current.startTime ? (Date.now() - stateRef.current.startTime) / 60000 : 0),
    [targetText, input, timeLeft]
  )

  const stopTimer = () => {
    if (stateRef.current.finishedTimer) {
      clearInterval(stateRef.current.finishedTimer)
      stateRef.current.finishedTimer = null
    }
  }

  useEffect(() => stopTimer, [])

  const finish = (finalInput: string) => {
    if (stateRef.current.isFinished) return
    stateRef.current.isFinished = true
    stopTimer()
    const elapsedMinutes = stateRef.current.startTime ? (Date.now() - stateRef.current.startTime) / 60000 : 0
    const stats = computeTypingStats(targetText, finalInput, elapsedMinutes)
    setResult({
      wpm: stats.wpm,
      cpm: stats.cpm,
      accuracy: stats.accuracy,
      correct: stats.correct,
      wrong: stats.wrong,
      rating: getTypingRating(stats.wpm, lang),
    })
    setPhase('result')
    inputRef.current?.blur()
  }

  const start = () => {
    stopTimer()
    stateRef.current = {
      ...stateRef.current,
      startTime: 0,
      isRunning: false,
      isFinished: false,
      zhBuffer: '',
      finishedTimer: null,
    }
    setTargetText(generateTypingText(lang, difficulty))
    setInput('')
    setTimeLeft(duration)
    setResult(null)
    setPhase('running')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleInput = (rawValue: string, compositionData?: string) => {
    const state = stateRef.current
    if (state.isFinished || state.composing) return
    const rawValueNormalized = lang === 'zh' ? state.zhBuffer : rawValue

    const prevLen = normalizeTypingValue(input).length
    const nextInput = lang === 'zh'
      ? rawValueNormalized + (compositionData ? normalizeTypingValue(compositionData) : '')
      : rawValue

    setInput(nextInput)

    const nextNormalized = normalizeTypingValue(nextInput)
    if (!state.isRunning && nextNormalized.length > 0) {
      state.isRunning = true
      state.startTime = Date.now()
      state.finishedTimer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            finishRef.current?.(input)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    if (nextNormalized.length >= normalizedTarget.length && nextNormalized.length > 0) {
      // 输入长度达到目标：立即结算（正确率统计见 computeTypingStats）
      const stats = computeTypingStats(targetText, nextInput, (Date.now() - state.startTime) / 60000)
      if (stats.wrong === 0 || nextNormalized.length >= normalizedTarget.length) {
        finish(nextInput)
      }
    } else if (nextNormalized.length > prevLen) {
      // 打字/错误音效（WebAudio 振荡器合成）
      const lastIdx = nextNormalized.length - 1
      if (nextNormalized[lastIdx] === normalizedTarget[lastIdx]) playTone('key')
      else playTone('error')
    }
  }

  const finishRef = useRef<(input: string) => void>(finish)
  finishRef.current = finish

  const playTone = (kind: 'key' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      if (kind === 'key') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1200, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.06)
      } else {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(300, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.1)
      }
      osc.onended = () => void ctx.close()
    } catch {
      /* 音频不可用时静默 */
    }
  }

  // ---- 渲染目标文本逐字符着色 ----
  const renderTarget = () => {
    const segments = targetText.trim().split(/\s+/).filter(Boolean)
    let cursor = 0
    let currentPlaced = false
    const nodes: React.ReactNode[] = []
    segments.forEach((segment, segIdx) => {
      const chars: React.ReactNode[] = []
      for (let i = 0; i < segment.length; i++) {
        const ch = segment[i]
        let cls = ''
        if (normalizedInput[cursor] != null) {
          cls = normalizedInput[cursor] === normalizedTarget[cursor] ? 'text-mem-teal' : 'text-mem-coral bg-mem-coral/20 rounded'
        } else if (!currentPlaced && cursor === normalizedInput.length) {
          cls = 'bg-mem-ink text-white rounded'
          currentPlaced = true
        }
        chars.push(
          <span key={`${segIdx}-${i}`} className={`whitespace-pre ${cls}`}>{ch}</span>
        )
        cursor++
      }
      nodes.push(
        <span key={segIdx} className="mr-3 inline-block">{chars}</span>
      )
    })
    if (normalizedInput.length > normalizedTarget.length) {
      const extras: React.ReactNode[] = []
      for (let i = normalizedTarget.length; i < normalizedInput.length; i++) {
        extras.push(<span key={`x-${i}`} className="text-mem-coral bg-mem-coral/20 rounded">{normalizedInput[i]}</span>)
      }
      nodes.push(<span key="extra" className="inline-block">{extras}</span>)
    }
    return nodes
  }

  if (phase === 'settings') {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-mem-pink" />
          <h3 className="font-display font-black text-mem-ink">{t('tools.typingTest')}</h3>
        </div>
        <OptionRow
          label={t('textcenter.ttLanguage')}
          options={[
            { value: 'zh', label: t('textcenter.ttZh') },
            { value: 'en', label: t('textcenter.ttEn') },
          ]}
          value={lang}
          onChange={(v) => setLang(v as TypingLang)}
        />
        <OptionRow
          label={t('textcenter.ttDifficulty')}
          options={[
            { value: 'easy', label: t('textcenter.ttEasy') },
            { value: 'medium', label: t('textcenter.ttMedium') },
            { value: 'hard', label: t('textcenter.ttHard') },
            { value: 'master', label: t('textcenter.ttMaster') },
          ]}
          value={difficulty}
          onChange={(v) => setDifficulty(v as TypingDifficulty)}
        />
        <OptionRow
          label={t('textcenter.ttDuration')}
          options={TYPING_DURATIONS.map((d) => ({ value: String(d), label: `${d}s` }))}
          value={String(duration)}
          onChange={(v) => setDuration(Number(v))}
        />
        <MemphisButton variant="pink" onClick={start}>{t('textcenter.ttStart')}</MemphisButton>
      </div>
    )
  }

  if (phase === 'result' && result) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-mem-pink" />
          <h3 className="font-display font-black text-mem-ink">{t('textcenter.ttResult')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label={t('textcenter.ttWpm')} value={String(result.wpm)} accent />
          <StatTile label={t('textcenter.ttCpm')} value={String(result.cpm)} />
          <StatTile label={t('textcenter.ttAccuracy')} value={`${result.accuracy}%`} />
          <StatTile label={t('textcenter.ttCorrect')} value={String(result.correct)} />
          <StatTile label={t('textcenter.ttWrong')} value={String(result.wrong)} />
          <StatTile label={t('textcenter.ttRating')} value={result.rating} accent />
        </div>
        <div className="flex gap-2">
          <MemphisButton variant="pink" onClick={start}>{t('textcenter.ttAgain')}</MemphisButton>
          <MemphisButton variant="white" onClick={() => setPhase('settings')}>{t('textcenter.ttBack')}</MemphisButton>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-4" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-mem-pink" />
          <h3 className="font-display font-black text-mem-ink">{t('tools.typingTest')}</h3>
        </div>
        <button type="button" onClick={() => { stopTimer(); setPhase('settings') }} className="text-xs font-bold text-mem-ink/60 hover:text-mem-ink">
          {t('textcenter.ttBack')}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t('textcenter.ttWpm')} value={String(live.wpm)} accent />
        <StatTile label={t('textcenter.ttAccuracy')} value={`${live.accuracy}%`} />
        <StatTile
          label={t('textcenter.ttTimeLeft')}
          value={String(Math.max(0, timeLeft))}
          danger={timeLeft <= 10 && stateRef.current.isRunning}
        />
      </div>
      <div className="bg-white border-2 border-mem-ink rounded-2xl p-4 text-base leading-relaxed font-mono font-bold">
        {renderTarget()}
      </div>
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={lang === 'en' ? input : ''}
        onChange={(e) => {
          if (lang === 'zh') {
            // 中文 IME：从 composition 累积，输入框即输即清
            const clean = normalizeTypingValue(e.target.value)
            if (clean && !stateRef.current.composing) {
              stateRef.current.zhBuffer += clean
              handleInput('')
            }
            if (clean) e.target.value = ''
            return
          }
          handleInput(e.target.value)
        }}
        onCompositionStart={() => { stateRef.current.composing = true }}
        onCompositionEnd={(e) => {
          stateRef.current.composing = false
          if (lang === 'zh') {
            const data = normalizeTypingValue(e.data || (e.target as HTMLInputElement).value)
            ;(e.target as HTMLInputElement).value = ''
            if (data) {
              stateRef.current.zhBuffer += data
              handleInput('')
            }
          } else {
            handleInput((e.target as HTMLInputElement).value)
          }
        }}
        onKeyDown={(e) => {
          if (lang === 'zh' && e.key === 'Backspace' && !stateRef.current.composing && stateRef.current.zhBuffer.length > 0) {
            e.preventDefault()
            stateRef.current.zhBuffer = stateRef.current.zhBuffer.slice(0, -1)
            handleInput('')
          }
        }}
        className="w-full px-3 py-2.5 text-sm font-mono font-bold border-2 border-mem-ink rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-mem-pink"
        placeholder={t('textcenter.ttTargetHint')}
      />
    </div>
  )
}

const OptionRow: React.FC<{
  label: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}> = ({ label, options, value, onChange }) => (
  <div>
    <p className="text-xs font-bold text-mem-ink/60 uppercase mb-1.5">{label}</p>
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-xs font-bold border-2 border-mem-ink rounded-lg ${
            value === option.value ? 'bg-mem-pink text-mem-ink' : 'bg-white text-mem-ink/70 hover:bg-mem-pink/30'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
)

const StatTile: React.FC<{ label: string; value: string; accent?: boolean; danger?: boolean }> = ({
  label,
  value,
  accent,
  danger,
}) => (
  <div className={`px-3 py-2 border-2 border-mem-ink rounded-xl text-center ${danger ? 'bg-mem-coral/30' : accent ? 'bg-mem-pink/30' : 'bg-white'}`}>
    <p className="text-xs font-black uppercase text-mem-ink/60">{label}</p>
    <p className="font-display font-black text-lg">{value}</p>
  </div>
)

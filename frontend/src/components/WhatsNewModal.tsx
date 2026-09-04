import React, { useEffect, useState } from 'react'
import { Sparkles, Check, X } from 'lucide-react'
import { isRestrictedBrowser } from '../lib/deliver'
import { useI18n } from '../i18n'

/**
 * 「这次更新了什么」弹窗（round-22 新增）。
 *
 * 触发口径（zonkey.whatsNewSeen.v1，单键双字段）：
 * - { seenRound: N, lastSeenDay: 'YYYY-MM-DD' }，只在 seenRound 比当前更新轮低时弹出；
 *   看过（确认或关闭）后 seenRound 升到当前轮 → 该轮内容只打扰一次。
 * - 「当天首次打开」：同一天内看过一次即不再弹；跨天再次打开仍不弹（seenRound 已追上）。
 * - localStorage 不可用（隐私模式）时：本次会话内仅弹一次，不做持久化。
 * - 网页端每次启动都检查；桌面壳运行时白屏自愈的窗口回放不重复弹（双 rAF 退场即主挂载）。
 *
 * 维护规则：entries 内容（i18n whatsnew.entries）随构建哈希进包；「改内容必须升
 * WHATSNEW_ROUND」——否则已看过旧内容的用户不会再看到新条目（AGENTS_HANDOFF 接手注意已登记）。
 */

export const WHATSNEW_ROUND = 23
const WHATSNEW_KEY = 'zonkey.whatsNewSeen.v1'
/** 弹窗内展示最近几轮（含本轮），轮次数字向下走 */
const ROUND_WINDOW = 3

export interface WhatsNewSeen {
  seenRound: number
  lastSeenDay: string
}

export function readWhatsNewSeen(): WhatsNewSeen {
  try {
    const raw = localStorage.getItem(WHATSNEW_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<WhatsNewSeen>
      if (typeof p.seenRound === 'number' && typeof p.lastSeenDay === 'string') {
        return { seenRound: p.seenRound, lastSeenDay: p.lastSeenDay }
      }
    }
  } catch {
    /* 解析失败按未看过处理 */
  }
  return { seenRound: 0, lastSeenDay: '' }
}

function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function writeWhatsNewSeen(): void {
  try {
    const value: WhatsNewSeen = { seenRound: WHATSNEW_ROUND, lastSeenDay: todayStr() }
    localStorage.setItem(WHATSNEW_KEY, JSON.stringify(value))
  } catch {
    /* 隐私模式写入失败：仅本次会话内由内存态不再打扰 */
  }
}

function isToday(key: string): boolean {
  return key === todayStr()
}

/** 首次打开判定：版本更高 → 本轮看过（任何天）→ 本轮当天看过 → 均满足才弹 */
export function shouldShowWhatsNew(seen: WhatsNewSeen): boolean {
  if (seen.seenRound >= WHATSNEW_ROUND) return false
  if (seen.seenRound === WHATSNEW_ROUND - 1 && seen.lastSeenDay && isToday(seen.lastSeenDay)) return false
  return true
}

interface WhatsNewModalProps {
  open: boolean
  onClose: () => void
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ open, onClose }) => {
  const { t } = useI18n()
  const restricted = isRestrictedBrowser()
  // 展示窗口 = 当前轮往下 ROUND_WINDOW 轮；缺失的键（i18n 未写该轮）自动跳过
  const [rounds, setRounds] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const ids: string[] = []
    for (let r = WHATSNEW_ROUND; r >= WHATSNEW_ROUND - ROUND_WINDOW; r -= 1) {
      const probeKey = `whatsnew.entries.r${r}.badge`
      if (t(probeKey) !== probeKey) ids.push(`r${r}`)
    }
    setRounds(ids)
  }, [open, t])

  if (!open) return null

  const title = t('whatsnew.title')
  const desc = t('whatsnew.desc')

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-mem-ink/40 backdrop-blur-sm">
      <div
        className="memphis-card max-w-xl w-full max-h-[86dvh] overflow-y-auto p-5 md:p-6 relative animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center gap-2 mb-1 pr-8">
          <Sparkles className="w-5 h-5 text-mem-coral shrink-0" />
          <h2 className="font-brand text-xl brand-wordmark tracking-wider">{title}</h2>
        </div>
        <p className="text-xs text-mem-ink/60 leading-relaxed mb-4">{desc}</p>

        <div className="space-y-4 mb-4">
          {rounds.map((round) => (
            <section key={round} aria-label={t(`whatsnew.entries.${round}.badge`)}>
              <h3 className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border border-mem-coral/60 bg-mem-coral/15 text-mem-ink">
                  <Sparkles className="w-3 h-3 text-mem-coral" />
                  {t(`whatsnew.entries.${round}.badge`)}
                </span>
                <span className="text-[11px] font-medium text-mem-ink/50">
                  {t(`whatsnew.entries.${round}.date`)}
                </span>
              </h3>
              <ul className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((i) => {
                  const itemKey = `whatsnew.entries.${round}.i${i}`
                  const text = t(itemKey)
                  if (text === itemKey) return null
                  return (
                    <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-mem-ink/80">
                      <Check className="w-3.5 h-3.5 mt-0.5 text-mem-teal shrink-0" strokeWidth={3} />
                      <span>{text}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <p className="text-xs text-mem-ink/60 leading-relaxed mb-4">
          {t('whatsnew.noteDesktop')}
          {restricted && (
            <span className="block mt-1 bg-mem-yellow/40 border border-mem-ink/20 rounded-lg px-2.5 py-1.5">
              {t('privacy.restrictedBrowser')}
            </span>
          )}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="memphis-btn-primary flex items-center gap-1.5 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('whatsnew.gotIt')}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={title}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-mem-yellow/40 text-mem-ink/60"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

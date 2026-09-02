import React, { useMemo, useState } from 'react'
import { Palette, Copy, Check } from 'lucide-react'
import { useI18n } from '../../i18n'
import { copyTextToClipboard } from '../../lib/deliver'
import {
  COLOR_SPACE_SLIDER_CONFIG,
  fmtColorNumber,
  getSpaceValues,
  normalizeSliderValue,
  rgbToHex,
  spaceToDisplayRgb,
  spaceToXyz,
  xyzToAllSpaces,
  oklabInSrgbGamut,
  oklabInDisplayP3,
  oklabInAdobeRgb,
  oklabInRec2020,
  type SpaceId,
} from '../../lib/zonkey/colorSpaceCore'

const SPACE_ORDER: SpaceId[] = ['oklch', 'oklab', 'lab', 'lch', 'rgb', 'hsl', 'hsv', 'cmyk']

const DEFAULT_OKLCH = { L: 0.64, C: 0.16, H: 30 }

/** 色域对比：八种颜色空间实时联动 + 色域检查 */
export const ColorSpaceCompareView: React.FC = () => {
  const { t } = useI18n()
  const [space, setSpace] = useState<SpaceId>('oklch')
  const [valuesBySpace, setValuesBySpace] = useState<Partial<Record<SpaceId, Record<string, number>>>>(() => ({
    oklch: DEFAULT_OKLCH,
  }))

  const current = valuesBySpace[space]
  const channels = COLOR_SPACE_SLIDER_CONFIG[space].channels

  const { displayRgb, allSpaces } = useMemo(() => {
    if (!current) return { displayRgb: { r: 0, g: 0, b: 0 }, allSpaces: null }
    try {
      const rgb = spaceToDisplayRgb(space, current)
      const xyz = spaceToXyz(space, current)
      return { displayRgb: rgb, allSpaces: xyzToAllSpaces(xyz, rgb) }
    } catch {
      return { displayRgb: { r: 0, g: 0, b: 0 }, allSpaces: null }
    }
  }, [space, current])

  const gamuts = useMemo(() => {
    if (!allSpaces) return null
    const { L, a, b } = allSpaces.oklab
    return [
      { id: 'srgb', label: 'sRGB', ok: oklabInSrgbGamut(L, a, b) },
      { id: 'p3', label: 'Display P3', ok: oklabInDisplayP3(L, a, b) },
      { id: 'adobe', label: 'Adobe RGB', ok: oklabInAdobeRgb(L, a, b) },
      { id: 'rec2020', label: 'Rec.2020', ok: oklabInRec2020(L, a, b) },
    ]
  }, [allSpaces])

  const setChannel = (key: string, raw: number) => {
    const channel = channels.find((c) => c.key === key)
    if (!channel) return
    const snapped = normalizeSliderValue(raw, channel)
    if (snapped === null) return
    setValuesBySpace((prev) => ({ ...prev, [space]: { ...prev[space], [key]: snapped } }))
  }

  const switchSpace = (next: SpaceId) => {
    setSpace(next)
    setValuesBySpace((prev) => {
      if (prev[next]) return prev
      if (!allSpaces) return prev
      const seeded = getSpaceValues(next, allSpaces, displayRgb)
      return { ...prev, [next]: { ...seeded } }
    })
  }

  const cssCards = useMemo(() => {
    if (!allSpaces) return []
    const { oklch, lab, hsl, hsv, cmyk } = allSpaces
    const rgb = displayRgb
    return [
      { label: 'HEX', code: rgbToHex(rgb.r, rgb.g, rgb.b) },
      { label: 'RGB', code: `rgb(${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)})` },
      { label: 'OKLCH', code: `oklch(${fmtColorNumber(oklch.L, 3)} ${fmtColorNumber(oklch.C, 3)} ${fmtColorNumber(oklch.H, 1)}deg)` },
      { label: 'LAB', code: `lab(${fmtColorNumber(lab.L, 1)} ${fmtColorNumber(lab.a, 1)} ${fmtColorNumber(lab.b, 1)})` },
      { label: 'HSL', code: `hsl(${fmtColorNumber(hsl.h, 1)} ${fmtColorNumber(hsl.s, 1)}% ${fmtColorNumber(hsl.l, 1)}%)` },
      { label: 'HSV', code: `color(hsv ${fmtColorNumber(hsv.h, 1)} ${fmtColorNumber(hsv.s, 1)}% ${fmtColorNumber(hsv.v, 1)}%)` },
      { label: 'CMYK', code: `device-cmyk(${fmtColorNumber(cmyk.c, 1)}% ${fmtColorNumber(cmyk.m, 1)}% ${fmtColorNumber(cmyk.y, 1)}% ${fmtColorNumber(cmyk.k, 1)}%)` },
    ]
  }, [allSpaces, displayRgb])

  const hex = rgbToHex(displayRgb.r, displayRgb.g, displayRgb.b)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="w-5 h-5 text-mem-yellow" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.colorSpaceCompare')}</h3>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SPACE_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => switchSpace(id)}
            className={`px-3 py-1.5 text-xs font-bold border-2 border-mem-ink rounded-lg uppercase transition-colors ${
              space === id ? 'bg-mem-yellow text-mem-ink' : 'bg-white text-mem-ink/70 hover:bg-mem-yellow/30'
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4 items-start bg-white border-2 border-mem-ink rounded-2xl p-4">
        <div
          className="w-24 h-24 md:w-28 md:h-28 border-2 border-mem-ink rounded-xl shadow-[4px_4px_0_0_var(--mem-ink)]"
          style={{ backgroundColor: hex }}
        />
        <div className="min-w-0 space-y-2">
          <p className="font-mono font-black text-lg">{hex}</p>
          {gamuts && (
            <div className="flex flex-wrap gap-1.5">
              {gamuts.map((g) => (
                <span
                  key={g.id}
                  className={`px-2 py-0.5 text-xs font-bold border-2 border-mem-ink rounded-md ${
                    g.ok ? 'bg-mem-teal/70' : 'bg-white text-mem-ink/40 line-through'
                  }`}
                  title={g.ok ? t('imagecenter.csInGamut') : t('imagecenter.csOutOfGamut')}
                >
                  {g.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 bg-white border-2 border-mem-ink rounded-2xl p-4">
        <p className="text-xs font-bold text-mem-ink/60 uppercase">{t('imagecenter.csEditSpace')} · {space}</p>
        {channels.map((channel) => (
          <div key={channel.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 font-mono text-xs font-bold uppercase">
              {channel.key}
              {channel.unit || ''}
            </span>
            <input
              type="range"
              min={channel.min}
              max={channel.max}
              step={channel.step}
              value={current?.[channel.key] ?? channel.min}
              onChange={(e) => setChannel(channel.key, Number(e.target.value))}
              className="flex-1 accent-mem-yellow min-w-0"
            />
            <input
              type="number"
              min={channel.min}
              max={channel.max}
              step={channel.step}
              value={current?.[channel.key] ?? channel.min}
              onChange={(e) => setChannel(channel.key, Number(e.target.value))}
              className="w-20 shrink-0 px-2 py-1 text-xs font-mono font-bold border-2 border-mem-ink rounded-lg"
            />
          </div>
        ))}
      </div>

      {allSpaces && (
        <div className="bg-white border-2 border-mem-ink rounded-2xl p-4">
          <p className="text-xs font-bold text-mem-ink/60 uppercase mb-2">{t('imagecenter.csAllSpaces')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SPACE_ORDER.map((id) => {
              const v = getSpaceValues(id, allSpaces, displayRgb)
              const cfg = COLOR_SPACE_SLIDER_CONFIG[id].channels
              return (
                <div key={id} className="px-2 py-1.5 border border-mem-ink/30 rounded-lg">
                  <p className="text-xs font-black uppercase text-mem-ink/60">{id}</p>
                  <p className="font-mono text-xs font-bold break-all">
                    {cfg.map((c) => fmtColorNumber(v[c.key], c.decimals)).join(' · ')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <CssCards cards={cssCards} copiedLabel={t('imagecenter.csCopied')} />
    </div>
  )
}

const CssCards: React.FC<{ cards: Array<{ label: string; code: string }>; copiedLabel: string }> = ({
  cards,
  copiedLabel,
}) => {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (label: string, code: string) => {
    const ok = await copyTextToClipboard(code)
    if (ok) {
      setCopied(label)
      setTimeout(() => setCopied(null), 1200)
    }
  }
  return (
    <div className="bg-white border-2 border-mem-ink rounded-2xl p-4">
      <p className="text-xs font-bold text-mem-ink/60 uppercase mb-2">CSS</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => void copy(card.label, card.code)}
            className="flex items-center justify-between gap-2 px-3 py-1.5 text-left border-2 border-mem-ink rounded-xl hover:bg-mem-yellow/20"
          >
            <span className="min-w-0">
              <span className="block text-xs font-black uppercase text-mem-ink/60">{card.label}</span>
              <span className="block font-mono text-xs font-bold truncate">{card.code}</span>
            </span>
            {copied === card.label ? (
              <Check className="w-3.5 h-3.5 text-mem-teal shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-mem-ink/40 shrink-0" />
            )}
          </button>
        ))}
      </div>
      {copied && <p className="mt-2 text-xs font-bold text-mem-teal">{copiedLabel}</p>}
    </div>
  )
}

import React, { useMemo } from 'react'
import { ShieldCheck, MonitorSmartphone, Wifi, Cloud, X } from 'lucide-react'
import { isShellMode, isRestrictedBrowser } from '../lib/deliver'
import { useI18n } from '../i18n'

/**
 * 首次打开的「隐私与联网声明」。三种运行边界如实告知：
 * - 桌面壳（pywebview）：完全离线，文件不出本机；
 * - 手机/浏览器 · 局域网模式：页面由同一 WiFi 下的电脑提供，文件只在两台设备间直传；
 * - 手机/浏览器 · 公网隧道模式：经加密隧道连回电脑，传输加密、云端不存储，处理仍在本机。
 * 用户确认后写入 localStorage，之后可在页眉盾牌图标重新查看。
 */
export const PRIVACY_NOTICE_KEY = 'zonscale.privacyNotice.v1'

export function hasAcknowledgedPrivacyNotice(): boolean {
  try {
    return localStorage.getItem(PRIVACY_NOTICE_KEY) === 'ack'
  } catch {
    return false
  }
}

function acknowledgePrivacyNotice(): void {
  try {
    localStorage.setItem(PRIVACY_NOTICE_KEY, 'ack')
  } catch {
    /* 隐私模式下写入失败：仅在本次会话内不再打扰 */
  }
}

type NoticeMode = 'desktop' | 'lan' | 'tunnel'

function detectNoticeMode(): NoticeMode {
  if (isShellMode()) return 'desktop'
  if (/\.trycloudflare\.com$/i.test(window.location.hostname)) return 'tunnel'
  return 'lan'
}

interface OfflinePrivacyNoticeProps {
  open: boolean
  onClose: () => void
}

export const OfflinePrivacyNotice: React.FC<OfflinePrivacyNoticeProps> = ({ open, onClose }) => {
  const { t } = useI18n()
  const mode = useMemo(detectNoticeMode, [])
  const restricted = useMemo(isRestrictedBrowser, [])

  if (!open) return null

  const modeItems: { id: NoticeMode; icon: React.ReactNode; title: string; body: string }[] = [
    { id: 'desktop', icon: <MonitorSmartphone className="w-4 h-4" />, title: t('privacy.modeDesktopTitle'), body: t('privacy.modeDesktopBody') },
    { id: 'lan', icon: <Wifi className="w-4 h-4" />, title: t('privacy.modeLanTitle'), body: t('privacy.modeLanBody') },
    { id: 'tunnel', icon: <Cloud className="w-4 h-4" />, title: t('privacy.modeTunnelTitle'), body: t('privacy.modeTunnelBody') },
  ]

  const handleConfirm = () => {
    acknowledgePrivacyNotice()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-mem-ink/40 backdrop-blur-sm">
      <div
        className="memphis-card max-w-lg w-full max-h-[88dvh] overflow-y-auto p-5 md:p-6 relative animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-2 mb-1 pr-8">
          <ShieldCheck className="w-5 h-5 text-mem-teal shrink-0" />
          <h2 className="font-brand text-xl brand-wordmark tracking-wider">{t('privacy.title')}</h2>
        </div>
        <p className="text-xs text-mem-ink/60 leading-relaxed mb-3">{t('privacy.intro')}</p>

        <div className="space-y-2 mb-3">
          {modeItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border-2 p-3 transition-colors ${
                item.id === mode
                  ? 'border-mem-ink bg-mem-teal/15'
                  : 'border-mem-ink/15 bg-white/60 opacity-70'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-mem-ink/70">{item.icon}</span>
                <span className="font-display font-bold text-mem-ink text-xs">{item.title}</span>
                {item.id === mode && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-mem-ink bg-mem-yellow text-mem-ink">
                    {t('privacy.currentMode')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-mem-ink/70 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        <ul className="text-[11px] text-mem-ink/70 space-y-1 mb-3 list-none">
          <li className="flex gap-1.5"><span className="text-mem-teal font-bold">✓</span>{t('privacy.pointLocal')}</li>
          <li className="flex gap-1.5"><span className="text-mem-teal font-bold">✓</span>{t('privacy.pointNoAccount')}</li>
          <li className="flex gap-1.5"><span className="text-mem-teal font-bold">✓</span>{t('privacy.pointConnection')}</li>
        </ul>

        {restricted && (
          <p className="text-[11px] text-mem-ink/70 bg-mem-yellow/40 border border-mem-ink/20 rounded-lg px-3 py-2 mb-3 leading-relaxed">
            {t('privacy.restrictedBrowser')}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-medium text-mem-ink/50 hover:text-mem-ink px-3 py-2 rounded-lg"
          >
            {t('privacy.later')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="memphis-btn-primary flex items-center gap-1.5 text-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('privacy.confirm')}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-mem-yellow/40 text-mem-ink/50"
          aria-label={t('privacy.title')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

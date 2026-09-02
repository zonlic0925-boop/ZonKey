/**
 * 产物交付层 — 桌面壳（pywebview）与手机/桌面浏览器的统一出口。
 *
 * - 桌面壳：浏览器下载通道在壳内不可用（无下载管理器）。
 *   blob 产物先经 /api/export/save-blob 落到服务端 output/，再弹原生另存为对话框；
 *   服务端产物直接走 /api/export/save-as。
 * - 浏览器（手机/桌面）：blob 产物直接 a[download]；服务端产物走 /api/download 下载流
 *   （服务端返回 Content-Disposition: attachment，手机浏览器自动存入下载目录）。
 */
import { useEffect, useState } from 'react'
import { apiFetch, buildDownloadUrl, saveOutputFileAs } from './api'

/** 同步检测桌面壳（pywebview 注入 window.pywebview） */
export function isShellMode(): boolean {
  return typeof window !== 'undefined' && 'pywebview' in window
}

/** 异步检测桌面壳：注入发生在页面加载后，轮询一段时间再下结论 */
export async function isShellModeAsync(pollMs = 1500): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const deadline = Date.now() + pollMs
  for (;;) {
    if ('pywebview' in window) return true
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
}

/** React 侧的壳模式（注入稍晚于首帧时自动补判） */
export function useShellMode(): boolean {
  const [shell, setShell] = useState(isShellMode)
  useEffect(() => {
    if (shell) return
    let cancelled = false
    isShellModeAsync(2500).then((value) => {
      if (!cancelled) setShell(value)
    })
    return () => {
      cancelled = true
    }
  }, [shell])
  return shell
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/** 桌面壳内：把前端内存产物上传到服务端 output/，随后弹原生另存为对话框 */
async function saveBlobViaServer(blob: Blob, filename: string): Promise<DeliveryResult> {
  const form = new FormData()
  form.append('file', blob, filename)
  const data = await apiFetch<{ filename: string }>(
    '/api/export/save-blob',
    { method: 'POST', body: form },
    300000
  )
  const result = await saveOutputFileAs(undefined, data.filename)
  return result.cancelled
    ? { delivered: 'cancelled', keptIn: data.filename }
    : { delivered: 'saved', savedPath: result.savedPath, keptIn: data.filename }
}

/** downloadBlob 的交付结果：浏览器直下 / 原生另存成功 / 用户取消（产物仍在 output/） */
export type DeliveryResult =
  | { delivered: 'browser-download'; filename: string }
  | { delivered: 'saved'; savedPath?: string; keptIn?: string }
  | { delivered: 'cancelled'; keptIn?: string }

/**
 * 前端内存产物的统一下载出口（原 imageKit.downloadBlob 的跨环境升级版）。
 * 桌面壳走服务端中转 + 原生另存为；手机/桌面浏览器直接 a[download]。
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<DeliveryResult> {
  if (await isShellModeAsync()) {
    return saveBlobViaServer(blob, filename)
  }
  triggerBlobDownload(blob, filename)
  return { delivered: 'browser-download', filename }
}

/** 浏览器模式下触发服务端产物的下载流（/api/download/{filename}） */
export function triggerServerFileDownload(outputDir: string | undefined, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = buildDownloadUrl(outputDir, filename)
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/** 微信等内置浏览器下载通道受限，用于提示用户换系统浏览器 */
export function isRestrictedBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /MicroMessenger|QQ\/|Weibo/i.test(navigator.userAgent)
}

/** 简易移动端检测（触屏 + 窄屏），不依赖 UA */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  return (
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    window.innerWidth < 768
  )
}

/**
 * 复制文本：优先 navigator.clipboard（HTTPS/localhost），
 * 局域网 HTTP 等非安全上下文回退 execCommand（手机端复制按钮否则静默失效）。
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* 落到 execCommand 回退 */
    }
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  } catch {
    return false
  }
}

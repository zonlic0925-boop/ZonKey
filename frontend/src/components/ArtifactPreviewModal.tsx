/**
 * 产物内嵌预览层（round-29）——手机浏览器对 docx/xlsx 产物「打开」不再退级为下载。
 *
 * 渲染引擎全部复用仓库已有依赖（零新增）：
 * - docx → mammoth（docx→HTML，BSD-2-Clause，word-to-pdf 管线同源）
 * - xlsx/xls → SheetJS（sheet_to_html，Apache-2.0，excel-to-pdf 管线同源）
 * 均动态 import()（Vite 代码分割），只在真正预览时加载，不进主包。
 *
 * 文件零上传：blob 产物直接 arrayBuffer；服务端产物走 /api/download 流（与下载同源）。
 * 预览是「内容视图」：mammoth 只保留语义结构（标题/段落/表格/图片），
 * 精确排版以下载的文件为准——页脚有固定提示。
 */
import React, { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { TaskArtifact } from '../lib/zonkey/taskDone'
import { buildDownloadUrl } from '../lib/api'

interface ArtifactPreviewModalProps {
  artifact: TaskArtifact | null
  /** blob 产物的 objectURL（TaskDoneModal 持有其生命周期）；服务端产物传空走下载流 */
  blobUrl?: string
  onClose: () => void
}

async function loadArrayBuffer(artifact: TaskArtifact, blobUrl?: string): Promise<ArrayBuffer> {
  if (artifact.blob) return artifact.blob.arrayBuffer()
  const response = await fetch(buildDownloadUrl(artifact.outputDir, artifact.outputName ?? artifact.name))
  if (!response.ok) throw new Error(`fetch:${response.status}`)
  return response.arrayBuffer()
}

async function renderDocxHtml(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
  if (!result.value.trim()) throw new Error('empty-document')
  return result.value
}

async function renderXlsxHtml(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const sections: string[] = []
  for (const name of wb.SheetNames) {
    const table = XLSX.utils.sheet_to_html(wb.Sheets[name], { editable: false })
    const inner = /<body[^>]*>([\s\S]*)<\/body>/i.exec(table)
    sections.push(`<h3 class="zs-sheet-name">${name}</h3>${inner ? inner[1] : table}`)
  }
  return sections.join('<hr class="zs-sheet-sep"/>') || '<p>(空工作簿)</p>'
}

export const ArtifactPreviewModal: React.FC<ArtifactPreviewModalProps> = ({ artifact, blobUrl, onClose }) => {
  const { t } = useI18n()
  const [html, setHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!artifact) return
    let cancelled = false
    setHtml(null)
    setFailed(false)
    void (async () => {
      try {
        const buffer = await loadArrayBuffer(artifact, blobUrl)
        const ext = artifact.name.slice(artifact.name.lastIndexOf('.') + 1).toLowerCase()
        const rendered = ext === 'docx' ? await renderDocxHtml(buffer) : await renderXlsxHtml(buffer)
        if (!cancelled) setHtml(rendered)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [artifact, blobUrl])

  if (!artifact) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-mem-ink/70"
      onClick={onClose}
      data-testid="artifact-preview-modal"
    >
      <div
        className="bg-white w-full max-w-3xl max-h-[92dvh] flex flex-col border-4 border-mem-ink rounded-2xl shadow-memphis-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={artifact.name}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-mem-ink bg-mem-teal/20 shrink-0">
          <FileText className="w-5 h-5 text-mem-ink/70 shrink-0" />
          <div className="min-w-0 flex-1 font-mono text-xs font-bold text-mem-ink truncate">{artifact.name}</div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center border-2 border-mem-ink rounded-lg font-black hover:bg-mem-coral/30"
            aria-label={t('taskDone.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {failed ? (
            <div className="px-6 py-10 text-center text-sm font-bold text-mem-ink/60">{t('taskDone.previewFailed')}</div>
          ) : html === null ? (
            <div className="px-6 py-10 text-center text-sm font-bold text-mem-ink/60 animate-pulse">
              {t('taskDone.previewLoading')}
            </div>
          ) : (
            <div className="zs-doc-preview" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
        <div className="px-4 py-2.5 border-t-2 border-mem-ink bg-mem-yellow/20 shrink-0">
          <p className="text-[10px] font-medium text-mem-ink/50">{t('taskDone.previewNote')}</p>
        </div>
      </div>
      <style>{`
        .zs-doc-preview { padding: 22px 20px 30px; font-family: 'Microsoft YaHei','PingFang SC','Hiragino Sans GB',sans-serif; font-size: 14px; line-height: 1.75; color: #111; overflow-wrap: anywhere; }
        .zs-doc-preview h1 { font-size: 24px; margin: .7em 0 .5em; line-height: 1.3; }
        .zs-doc-preview h2 { font-size: 20px; margin: .7em 0 .5em; line-height: 1.3; }
        .zs-doc-preview h3 { font-size: 17px; margin: .6em 0 .4em; line-height: 1.3; }
        .zs-doc-preview h4, .zs-doc-preview h5, .zs-doc-preview h6 { font-size: 15px; margin: .6em 0 .4em; }
        .zs-doc-preview p { margin: .45em 0; }
        .zs-doc-preview table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 12.5px; }
        .zs-doc-preview td, .zs-doc-preview th { border: 1px solid #9a9a9a; padding: 5px 8px; text-align: left; vertical-align: top; }
        .zs-doc-preview th { background: #f0f0f0; font-weight: 700; }
        .zs-doc-preview ul, .zs-doc-preview ol { padding-left: 24px; margin: .4em 0; }
        .zs-doc-preview blockquote { border-left: 4px solid #b5b5b5; margin: 8px 0; padding: 2px 14px; color: #444; }
        .zs-doc-preview img { max-width: 100%; }
        .zs-doc-preview a { color: #0b7285; }
        .zs-doc-preview hr.zs-sheet-sep { border: none; border-top: 2px dashed #c9c9c9; margin: 18px 0; }
        .zs-doc-preview .zs-sheet-name { margin-top: .2em; }
      `}</style>
    </div>
  )
}

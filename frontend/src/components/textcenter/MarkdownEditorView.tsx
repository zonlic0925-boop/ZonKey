import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FileCode2 } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  applyMarkdownAction,
  buildStandaloneMarkdownHtml,
  createMarkdownRenderer,
  DEFAULT_MARKDOWN,
  extractMarkdownHeadings,
  MARKDOWN_DRAFT_KEY,
  sanitizeExportBaseName,
  type MarkdownAction,
} from '../../lib/toolknit/markdownCore'

const TOOLBAR_ACTIONS: { id: MarkdownAction; label: string }[] = [
  { id: 'bold', label: 'B' },
  { id: 'italic', label: 'I' },
  { id: 'strike', label: 'S' },
  { id: 'code', label: '<>' },
  { id: 'link', label: '🔗' },
  { id: 'quote', label: '❝' },
  { id: 'h1', label: 'H1' },
  { id: 'h2', label: 'H2' },
  { id: 'h3', label: 'H3' },
  { id: 'ul', label: '•' },
  { id: 'ol', label: '1.' },
  { id: 'task', label: '☑' },
  { id: 'table', label: '表格' },
  { id: 'codeblock', label: '```' },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const MarkdownEditorView: React.FC = () => {
  const { t } = useI18n()
  const renderer = useMemo(() => createMarkdownRenderer(), [])
  const [text, setText] = useState<string>(() => localStorage.getItem(MARKDOWN_DRAFT_KEY) ?? DEFAULT_MARKDOWN)
  const [selection, setSelection] = useState<[number, number]>([0, 0])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => localStorage.setItem(MARKDOWN_DRAFT_KEY, text), 400)
    return () => clearTimeout(timer)
  }, [text])

  const html = useMemo(() => DOMPurify.sanitize(renderer.render(text)), [renderer, text])
  const headings = useMemo(() => extractMarkdownHeadings(text), [text])

  const applyAction = (action: MarkdownAction) => {
    const [start, end] = selection
    const result = applyMarkdownAction(text, start, end, action)
    setText(result.text)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(result.start, result.end)
    })
  }

  const baseName = sanitizeExportBaseName(headings[0]?.text ?? 'zonscale-document')

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full min-h-0 gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-5 h-5 text-mem-pink" />
          <h3 className="font-display font-black text-mem-ink">{t('tools.markdownEditor')}</h3>
        </div>
        <div className="flex gap-2">
          <MemphisButton
            size="sm"
            variant="white"
            onClick={() => downloadBlob(new Blob([text], { type: 'text/markdown' }), `${baseName}.md`)}
          >
            .md
          </MemphisButton>
          <MemphisButton
            size="sm"
            variant="pink"
            onClick={() =>
              downloadBlob(
                new Blob([buildStandaloneMarkdownHtml({ title: headings[0]?.text ?? 'ZonScale', renderedHtml: html })], { type: 'text/html' }),
                `${baseName}.html`,
              )
            }
          >
            .html
          </MemphisButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAction(action.id)}
            className="px-2 py-1 text-[11px] font-bold border-2 border-mem-ink rounded-lg bg-white hover:bg-mem-pink/20 transition-colors min-w-[28px]"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onSelect={(e) => {
            const el = e.currentTarget
            setSelection([el.selectionStart ?? 0, el.selectionEnd ?? 0])
          }}
          className="h-full min-h-[320px] w-full resize-none p-3 border-2 border-mem-ink rounded-2xl text-xs font-mono bg-white focus:outline-none focus:shadow-memphis-sm"
        />
        <div className="h-full min-h-[320px] overflow-auto p-4 border-2 border-mem-ink rounded-2xl bg-white prose prose-sm max-w-none [&_ul_task-list-item]:list-none">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  )
}

import React from 'react'

interface WordMatchSpan {
  start: number
  end: number
  text: string
  replacement?: string
  type?: string
}

interface WordHighlightTextProps {
  text: string
  matches?: WordMatchSpan[]
}

export const WordHighlightText: React.FC<WordHighlightTextProps> = ({ text, matches = [] }) => {
  if (!matches.length) {
    return <>{text}</>
  }

  const sorted = [...matches].sort((a, b) => a.start - b.start)
  const parts: React.ReactNode[] = []
  let cursor = 0

  sorted.forEach((match, idx) => {
    if (match.start < cursor) return
    if (match.start > cursor) {
      parts.push(<span key={`t-${idx}-${cursor}`}>{text.slice(cursor, match.start)}</span>)
    }
    parts.push(
      <mark
        key={`m-${idx}-${match.start}`}
        className="bg-mem-coral/45 text-mem-ink px-0.5 rounded-sm border-b-2 border-mem-coral font-semibold"
        title={match.replacement ? `将替换为：${match.replacement}` : undefined}
      >
        {text.slice(match.start, match.end)}
      </mark>
    )
    cursor = match.end
  })

  if (cursor < text.length) {
    parts.push(<span key={`t-tail-${cursor}`}>{text.slice(cursor)}</span>)
  }

  return <>{parts}</>
}

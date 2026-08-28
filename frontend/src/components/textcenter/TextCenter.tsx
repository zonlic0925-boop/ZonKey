import React from 'react'
import type { ToolId } from '../../types'
import { MarkdownEditorView } from './MarkdownEditorView'
import { TextStatsView } from './TextStatsView'
import { TextFormatView } from './TextFormatView'

/** 文本工坊中心：按二级工具 ID 渲染对应视图 */
export const TextCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'markdown-editor':
      return <MarkdownEditorView />
    case 'text-stats':
      return <TextStatsView />
    case 'text-format':
      return <TextFormatView />
    default:
      return null
  }
}

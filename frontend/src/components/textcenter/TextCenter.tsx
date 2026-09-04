import React from 'react'
import type { ToolId } from '../../types'
import { MarkdownEditorView } from './MarkdownEditorView'
import { TextStatsView } from './TextStatsView'
import { TextFormatView } from './TextFormatView'
import { TranscriptionView } from './TranscriptionView'
import { TypingTestView } from './TypingTestView'
import { DiffView, RegexTesterView, BatchRenameView } from '../toolbox/ToolboxTextViews'
import { TtsView } from '../toolbox/ToolboxEngineViews'

/** 文本工坊中心：按二级工具 ID 渲染对应视图 */
export const TextCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'markdown-editor':
      return <MarkdownEditorView />
    case 'text-stats':
      return <TextStatsView />
    case 'text-format':
      return <TextFormatView />
    case 'text-diff':
      return <DiffView />
    case 'regex-tester':
      return <RegexTesterView />
    case 'batch-rename':
      return <BatchRenameView />
    case 'tts':
      return <TtsView />
    case 'transcription':
      return <TranscriptionView />
    case 'typing-test':
      return <TypingTestView />
    default:
      return null
  }
}

import React from 'react'
import type { ToolId } from '../../types'
import { PptCompressView, PptImagesView, PptTextView } from './PptCenterViews'
import { PptToImageView, PptToPdfView } from './PptRenderViews'
import { PptDraftView, PptOutlineView } from './PptDraftViews'

/** PPT 工坊：转 PDF/转长图走后端本机渲染（LibreOffice/PowerPoint COM），大纲/草稿离线生成 */
export const PptCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'ppt-home':
    case 'ppt-to-pdf':
      return <PptToPdfView />
    case 'ppt-to-image':
      return <PptToImageView />
    case 'ppt-images':
      return <PptImagesView />
    case 'ppt-text':
      return <PptTextView />
    case 'ppt-compress':
      return <PptCompressView />
    case 'ppt-outline':
      return <PptOutlineView />
    case 'ppt-draft':
      return <PptDraftView />
    default:
      return null
  }
}

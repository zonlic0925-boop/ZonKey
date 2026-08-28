import React from 'react'
import type { ToolId } from '../../types'
import { PptCompressView, PptImagesView, PptTextView } from './PptCenterViews'

/** PPT 工坊：转 PDF/长图（渲染引擎）与 AI 大纲/草稿属后续批次 */
export const PptCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'ppt-images':
      return <PptImagesView />
    case 'ppt-text':
      return <PptTextView />
    case 'ppt-compress':
      return <PptCompressView />
    default:
      return null
  }
}

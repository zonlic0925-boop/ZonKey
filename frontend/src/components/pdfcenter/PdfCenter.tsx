import React from 'react'
import type { ToolId } from '../../types'
import { PdfMergeView } from './PdfMergeView'
import { PdfSplitView } from './PdfSplitView'
import { PdfRotateView } from './PdfRotateView'
import { PdfCompressView } from './PdfCompressView'

/** PDF 工坊：按二级工具 ID 渲染对应视图（转图/加密/解密/增强/页面编辑器见第二批） */
export const PdfCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'pdf-merge':
      return <PdfMergeView />
    case 'pdf-split':
      return <PdfSplitView />
    case 'pdf-rotate':
      return <PdfRotateView />
    case 'pdf-compress':
      return <PdfCompressView />
    default:
      return null
  }
}

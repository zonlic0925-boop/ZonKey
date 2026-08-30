import React from 'react'
import type { ToolId } from '../../types'
import { PdfMergeView } from './PdfMergeView'
import { PdfSplitView } from './PdfSplitView'
import { PdfExtractView } from './PdfExtractView'
import { PdfRotateView } from './PdfRotateView'
import { PdfCompressView } from './PdfCompressView'
import { PdfToImageView } from './PdfToImageView'
import { PdfImagesToPdfView } from './PdfImagesToPdfView'
import { PdfEncryptView } from './PdfEncryptView'
import { PdfDecryptView } from './PdfDecryptView'
import { PdfEnhanceView } from './PdfEnhanceView'
import { PdfEditorView } from './PdfEditorView'
import { PdfWatermarkView } from './PdfWatermarkView'
import { PdfPageNumbersView } from './PdfPageNumbersView'
import { PdfCropView } from './PdfCropView'
import { ConvertView } from './ConvertView'

/** PDF 工坊：按二级工具 ID 渲染对应视图 */
export const PdfCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'pdf-editor':
      return <PdfEditorView />
    case 'pdf-merge':
      return <PdfMergeView />
    case 'pdf-split':
      return <PdfSplitView />
    case 'pdf-extract':
      return <PdfExtractView />
    case 'pdf-to-image':
      return <PdfToImageView />
    case 'pdf-images-to-pdf':
      return <PdfImagesToPdfView />
    case 'pdf-rotate':
      return <PdfRotateView />
    case 'pdf-encrypt':
      return <PdfEncryptView />
    case 'pdf-decrypt':
      return <PdfDecryptView />
    case 'pdf-compress':
      return <PdfCompressView />
    case 'pdf-enhance':
      return <PdfEnhanceView />
    case 'pdf-watermark':
      return <PdfWatermarkView />
    case 'pdf-page-numbers':
      return <PdfPageNumbersView />
    case 'pdf-crop':
      return <PdfCropView />
    case 'pdf-to-word':
    case 'pdf-to-excel':
    case 'pdf-to-ppt':
    case 'office-to-pdf':
    case 'compress-deep':
    case 'html-to-pdf':
    case 'ocr-export':
    case 'pdf-repair':
      return <ConvertView op={tool} />
    default:
      return null
  }
}

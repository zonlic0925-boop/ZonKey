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
import { PdfOrganizeView } from './PdfOrganizeView'
import { PdfFormsView } from './PdfFormsView'
import { PdfCertSignView } from './PdfCertSignView'
import { PdfWatermarkView } from './PdfWatermarkView'
import { PdfPageNumbersView } from './PdfPageNumbersView'
import { PdfCropView } from './PdfCropView'
import { ConvertView } from './ConvertView'

export const PdfCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'pdf-home':
      return null
    case 'pdf-organize':
      return <PdfOrganizeView />
    case 'pdf-editor':
      return <PdfEditorView />
    case 'pdf-merge':
      return <PdfMergeView />
    case 'pdf-split':
      return <PdfSplitView />
    case 'pdf-extract':
      return <PdfExtractView />
    case 'pdf-rotate':
      return <PdfRotateView />
    case 'pdf-compress':
      return <PdfCompressView />
    case 'pdf-to-image':
      return <PdfToImageView />
    case 'pdf-images-to-pdf':
      return <PdfImagesToPdfView />
    case 'pdf-encrypt':
      return <PdfEncryptView />
    case 'pdf-decrypt':
      return <PdfDecryptView />
    case 'pdf-enhance':
      return <PdfEnhanceView />
    case 'pdf-watermark':
      return <PdfWatermarkView />
    case 'pdf-page-numbers':
      return <PdfPageNumbersView />
    case 'pdf-crop':
      return <PdfCropView />
    case 'pdf-forms':
      return <PdfFormsView />
    case 'pdf-cert-sign':
      return <PdfCertSignView />
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
      if (tool.startsWith('cv-')) {
        return <ConvertView op={tool} />
      }
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center text-mem-ink/60">
          <p className="text-lg font-medium mb-2">抱歉，功能维护中</p>
          <p className="text-sm">引擎在 {tool} 处理期间已离线</p>
        </div>
      )
  }
}

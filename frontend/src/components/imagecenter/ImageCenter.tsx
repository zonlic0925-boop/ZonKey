import React from 'react'
import type { ToolId } from '../../types'
import { ImageCompressView, ImageConvertView } from './ImageBatchViews'
import { ImageColorReplaceView, ImageCropView } from './ImageEditViews'
import { ColorPaletteView, IconGenView, ImageStitchView } from './ImageComposeViews'
import { ColorSpaceCompareView } from './ColorSpaceCompareView'

/** 图像工坊：按二级工具 ID 渲染对应视图 */
export const ImageCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'image-convert':
      return <ImageConvertView />
    case 'image-compress':
      return <ImageCompressView />
    case 'image-crop':
      return <ImageCropView />
    case 'image-color-replace':
      return <ImageColorReplaceView />
    case 'image-stitch':
      return <ImageStitchView />
    case 'icon-gen':
      return <IconGenView />
    case 'color-extractor':
      return <ColorPaletteView />
    case 'color-space-compare':
      return <ColorSpaceCompareView />
    default:
      return null
  }
}

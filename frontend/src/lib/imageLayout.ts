/** 计算 object-contain 下 img 元素内真实图像内容的布局（PDF 点坐标 → 叠加层像素）。 */

export interface ContainedImageMetrics {
  offsetX: number
  offsetY: number
  scaleX: number
  scaleY: number
  contentWidth: number
  contentHeight: number
}

export function getContainedImageMetrics(
  img: HTMLImageElement,
  pageWidth: number,
  pageHeight: number
): ContainedImageMetrics {
  const layoutW = img.clientWidth
  const layoutH = img.clientHeight
  const naturalW = img.naturalWidth || layoutW
  const naturalH = img.naturalHeight || layoutH

  if (layoutW <= 0 || layoutH <= 0 || pageWidth <= 0 || pageHeight <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      contentWidth: layoutW,
      contentHeight: layoutH,
    }
  }

  const fitScale = Math.min(layoutW / naturalW, layoutH / naturalH)
  const contentWidth = naturalW * fitScale
  const contentHeight = naturalH * fitScale
  const offsetX = (layoutW - contentWidth) / 2
  const offsetY = (layoutH - contentHeight) / 2

  // PDF 点 → 预览图像素（natural 尺寸 = page 尺寸 × dpi/72）
  const scaleX = contentWidth / pageWidth
  const scaleY = contentHeight / pageHeight

  return { offsetX, offsetY, scaleX, scaleY, contentWidth, contentHeight }
}

export function pdfBoxToOverlayPixels(
  bbox: [number, number, number, number],
  metrics: ContainedImageMetrics
): { left: number; top: number; width: number; height: number } {
  const [x0, y0, x1, y1] = bbox
  return {
    left: x0 * metrics.scaleX + metrics.offsetX,
    top: y0 * metrics.scaleY + metrics.offsetY,
    width: (x1 - x0) * metrics.scaleX,
    height: (y1 - y0) * metrics.scaleY,
  }
}

export function overlayPointerToPdf(
  layoutX: number,
  layoutY: number,
  metrics: ContainedImageMetrics
): { x: number; y: number } | null {
  const x = layoutX - metrics.offsetX
  const y = layoutY - metrics.offsetY
  if (x < 0 || y < 0 || x > metrics.contentWidth || y > metrics.contentHeight) {
    return null
  }
  return {
    x: x / metrics.scaleX,
    y: y / metrics.scaleY,
  }
}

export function formatCandidateLabel(
  matchedTerms: string[] | undefined,
  text: string | undefined,
  fallback: string
): string {
  const terms = (matchedTerms || []).map((t) => String(t).trim()).filter(Boolean)
  if (terms.length) {
    const sorted = [...terms].sort((a, b) => a.length - b.length)
    return sorted.length === 1 ? sorted[0] : sorted.slice(0, 2).join(' / ')
  }
  return text?.trim() || fallback
}

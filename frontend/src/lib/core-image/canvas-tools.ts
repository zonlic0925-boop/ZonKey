// Pure Local Canvas Image processing algorithms

export interface ColorSwatch {
  hex: string
  rgb: string
  hsl: string
  population: number
}

export function extractPaletteFromImage(
  img: HTMLImageElement,
  colorCount: number = 6
): ColorSwatch[] {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const sampleSize = 100
  canvas.width = sampleSize
  canvas.height = sampleSize
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize)

  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data
  const colorBuckets: Record<string, { r: number; g: number; b: number; count: number }> = {}

  for (let i = 0; i < imageData.length; i += 4) {
    const a = imageData[i + 3]
    if (a < 128) continue

    // Quantize 5-bit
    const r = Math.round(imageData[i] / 16) * 16
    const g = Math.round(imageData[i + 1] / 16) * 16
    const b = Math.round(imageData[i + 2] / 16) * 16

    const key = `${r},${g},${b}`
    if (!colorBuckets[key]) {
      colorBuckets[key] = { r, g, b, count: 0 }
    }
    colorBuckets[key].count++
  }

  const sorted = Object.values(colorBuckets).sort((a, b) => b.count - a.count)
  const topColors = sorted.slice(0, colorCount)

  return topColors.map((c) => {
    const hex = `#${((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1).toUpperCase()}`
    const rgb = `rgb(${c.r}, ${c.g}, ${c.b})`

    // Calculate HSL
    const rNorm = c.r / 255
    const gNorm = c.g / 255
    const bNorm = c.b / 255
    const max = Math.max(rNorm, gNorm, bNorm)
    const min = Math.min(rNorm, gNorm, bNorm)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case rNorm:
          h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
          break
        case gNorm:
          h = (bNorm - rNorm) / d + 2
          break
        case bNorm:
          h = (rNorm - gNorm) / d + 4
          break
      }
      h /= 6
    }

    const hsl = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`

    return {
      hex,
      rgb,
      hsl,
      population: c.count,
    }
  })
}

export async function stitchImages(
  images: HTMLImageElement[],
  direction: 'vertical' | 'horizontal' | 'grid',
  gap: number = 10,
  bgColor: string = '#FFFFFF'
): Promise<string> {
  if (images.length === 0) return ''

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  if (direction === 'vertical') {
    const maxWidth = Math.max(...images.map((img) => img.naturalWidth))
    const totalHeight =
      images.reduce((sum, img) => sum + img.naturalHeight, 0) + (images.length - 1) * gap

    canvas.width = maxWidth
    canvas.height = totalHeight

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    let currentY = 0
    images.forEach((img) => {
      const offsetX = (maxWidth - img.naturalWidth) / 2
      ctx.drawImage(img, offsetX, currentY)
      currentY += img.naturalHeight + gap
    })
  } else if (direction === 'horizontal') {
    const maxHeight = Math.max(...images.map((img) => img.naturalHeight))
    const totalWidth =
      images.reduce((sum, img) => sum + img.naturalWidth, 0) + (images.length - 1) * gap

    canvas.width = totalWidth
    canvas.height = maxHeight

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    let currentX = 0
    images.forEach((img) => {
      const offsetY = (maxHeight - img.naturalHeight) / 2
      ctx.drawImage(img, currentX, offsetY)
      currentX += img.naturalWidth + gap
    })
  } else {
    // 2x2 Grid
    const cols = Math.ceil(Math.sqrt(images.length))
    const rows = Math.ceil(images.length / cols)
    const cellW = Math.max(...images.map((img) => img.naturalWidth))
    const cellH = Math.max(...images.map((img) => img.naturalHeight))

    canvas.width = cols * cellW + (cols - 1) * gap
    canvas.height = rows * cellH + (rows - 1) * gap

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    images.forEach((img, idx) => {
      const r = Math.floor(idx / cols)
      const c = idx % cols
      const x = c * (cellW + gap) + (cellW - img.naturalWidth) / 2
      const y = r * (cellH + gap) + (cellH - img.naturalHeight) / 2
      ctx.drawImage(img, x, y)
    })
  }

  return canvas.toDataURL('image/png')
}

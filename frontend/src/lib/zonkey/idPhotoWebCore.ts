/**
 * 证件照浏览器引擎（后端离线兜底 = 手机网页版主通道）。
 *
 * 与 backend_toolbox_tools.id-photo 的 replace 主通道对齐：四角中值色估计底色 →
 * 色距阈值分出前景 → 前景包围盒按证件比例裁剪（头部居上）→ 边缘羽化合成新底色
 * → 缩放标准尺寸输出 PNG。
 *
 * 诚实边界（相对后端引擎的降级，UI 以 idWebEngineNote 提示）：
 * - 无 GrabCut 回退——底色不均/复杂背景直接报错，引导换纯色底照片或 keep 模式手动裁剪；
 * - 无形态学清理与最大连通域筛选，仅单遍 3×3 多数平滑去孤立噪块；
 * - canvas 编码的 PNG 不含 pHYs，打印 DPI 元数据需桌面版后端产物。
 */

export type IdPhotoSizePreset = 'one-inch' | 'two-inch' | 'small-two-inch' | 'one-inch-large'

/** name -> (宽mm, 高mm)：与后端 ID_PHOTO_SIZES 打印尺寸对齐 */
export const ID_PHOTO_SIZE_MM: Record<IdPhotoSizePreset, { w: number; h: number }> = {
  'one-inch': { w: 25, h: 35 },
  'two-inch': { w: 35, h: 49 },
  'small-two-inch': { w: 33, h: 48 },
  'one-inch-large': { w: 33, h: 48 },
}

export const ID_PHOTO_DPI = 300

export interface IdPhotoCropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface IdPhotoWebOptions {
  bgColor: string
  sizePreset: IdPhotoSizePreset
  bgMode: 'replace' | 'keep'
  /** 前端裁剪画布输出（原图像素），语义与后端一致——全图矩形等效于不裁 */
  crop?: IdPhotoCropRect | null
  /** 色距容差 10-120，默认 40（与后端一致） */
  tolerance?: number
}

export interface IdPhotoWebResult {
  blob: Blob
  fileName: string
}

/** 工作分辨率上限：证件照产物最长边仅 ~580px，超大的手机原图先降采样再处理 */
const MAX_WORK_PX = 2000

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!match) throw new Error('底色须为 #RRGGBB 格式')
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)))
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas-encode-failed'))),
      'image/png',
    )
  })
}

export async function runIdPhotoWeb(file: Blob, opts: IdPhotoWebOptions): Promise<IdPhotoWebResult> {
  const preset = ID_PHOTO_SIZE_MM[opts.sizePreset]
  if (!preset) throw new Error('尺寸预设不支持')
  if (opts.bgMode !== 'replace' && opts.bgMode !== 'keep') {
    throw new Error('bg_mode 须为 replace 或 keep')
  }
  const tolerance = Math.max(10, Math.min(120, Math.round(opts.tolerance ?? 40)))
  const targetRatio = preset.w / preset.h
  const targetPxW = Math.round((preset.w / 25.4) * ID_PHOTO_DPI)
  const targetPxH = Math.round((preset.h / 25.4) * ID_PHOTO_DPI)

  // EXIF 方向解码：手机竖拍照片（Orientation=6/8）必须转正后再处理
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    // 0) 用户预裁剪（前端画布矩形，原图像素）——与后端语义一致
    let sx = 0
    let sy = 0
    let sw = bitmap.width
    let sh = bitmap.height
    const c = opts.crop
    if (c && Math.min(c.x, c.y, c.width, c.height) >= 0) {
      sx = clampInt(c.x, 0, bitmap.width - 1)
      sy = clampInt(c.y, 0, bitmap.height - 1)
      sw = Math.max(1, Math.min(bitmap.width - sx, Math.round(c.width)))
      sh = Math.max(1, Math.min(bitmap.height - sy, Math.round(c.height)))
      if (sw < 50 || sh < 50) throw new Error('裁剪区域过小（至少 50×50 像素）')
    }

    // 超大原图降采样到工作分辨率
    const scale = Math.min(1, MAX_WORK_PX / Math.max(sw, sh))
    const workW = Math.max(1, Math.round(sw * scale))
    const workH = Math.max(1, Math.round(sh * scale))
    const work = document.createElement('canvas')
    work.width = workW
    work.height = workH
    const wctx = work.getContext('2d', { willReadFrequently: true })!
    wctx.imageSmoothingQuality = 'high'
    wctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, workW, workH)

    const baseName = (file instanceof File ? file.name : 'photo').replace(/\.[^.\\/]+$/, '') || 'photo'

    if (opts.bgMode === 'keep') {
      // 仅裁剪尺寸：不识别不换底，纯几何裁剪 + 缩放（与后端 keep 分支一致）
      let cx0 = 0
      let cy0 = 0
      let cw = workW
      let ch = workH
      if (workW / workH > targetRatio) {
        cw = Math.max(1, Math.round(workH * targetRatio))
        cx0 = Math.floor((workW - cw) / 2)
      } else {
        ch = Math.max(1, Math.round(workW / targetRatio))
        cy0 = 0 // 源过高裁下侧：证件照头部居上，保留上部
      }
      const out = document.createElement('canvas')
      out.width = targetPxW
      out.height = targetPxH
      const octx = out.getContext('2d')!
      octx.imageSmoothingQuality = 'high'
      octx.drawImage(work, cx0, cy0, cw, ch, 0, 0, targetPxW, targetPxH)
      const blob = await canvasToPng(out)
      return { blob, fileName: `${baseName}_idphoto.png` }
    }

    // 1) 主通道：四角中值色估计底色（与后端一致的 h/20 × w/20 条带）
    const img = wctx.getImageData(0, 0, workW, workH)
    const px = img.data
    const cornerSamples: number[][] = [[], [], []]
    const bandW = Math.max(1, Math.floor(workW / 20))
    const bandH = Math.max(1, Math.floor(workH / 20))
    const pushCorner = (x0: number, y0: number) => {
      for (let y = y0; y < y0 + bandH && y < workH; y++) {
        for (let x = x0; x < x0 + bandW && x < workW; x++) {
          const i = (y * workW + x) * 4
          cornerSamples[0].push(px[i])
          cornerSamples[1].push(px[i + 1])
          cornerSamples[2].push(px[i + 2])
        }
      }
    }
    pushCorner(0, 0)
    pushCorner(workW - bandW, 0)
    pushCorner(0, workH - bandH)
    pushCorner(workW - bandW, workH - bandH)
    const bg = cornerSamples.map((ch) => {
      const sorted = ch.slice().sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }) as [number, number, number]

    // 2) 色距前景 + 3×3 多数平滑（单遍：去背景侧孤立噪点、补人像内部小孔）
    const tolSq = tolerance * tolerance
    const person = new Uint8Array(workW * workH)
    let personCount = 0
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      const dr = px[i] - bg[0]
      const dg = px[i + 1] - bg[1]
      const db = px[i + 2] - bg[2]
      if (dr * dr + dg * dg + db * db > tolSq) {
        person[p] = 1
        personCount++
      }
    }
    const personFrac = personCount / (workW * workH)
    if (personFrac < 0.02 || personFrac > 0.9) {
      throw new Error(
        '未能识别到前景人像：浏览器引擎仅支持纯色/近纯色背景，请更换背景更干净的照片，或改用「仅裁剪尺寸」模式',
      )
    }
    const smoothed = new Uint8Array(person)
    for (let y = 1; y < workH - 1; y++) {
      for (let x = 1; x < workW - 1; x++) {
        const p = y * workW + x
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            n += person[p + dy * workW + dx]
          }
        }
        smoothed[p] = n >= 4 ? 1 : 0
      }
    }

    // 3) 前景包围盒 → 按证件比例裁剪（头部居上，与后端 top_ratio=0.12 对齐）
    let px0 = workW
    let py0 = workH
    let px1 = -1
    let py1 = -1
    for (let y = 0; y < workH; y++) {
      for (let x = 0; x < workW; x++) {
        if (smoothed[y * workW + x]) {
          if (x < px0) px0 = x
          if (x > px1) px1 = x
          if (y < py0) py0 = y
          if (y > py1) py1 = y
        }
      }
    }
    if (px1 < 0) throw new Error('未能识别到前景人像：请更换背景更干净的照片')
    const fw = px1 - px0 + 1
    const fh = py1 - py0 + 1
    const cropW = Math.max(fw, Math.round(fh * targetRatio))
    const cropH = Math.max(fh, Math.round(cropW / targetRatio))
    const cxCenter = Math.floor((px0 + px1) / 2)
    const topPad = Math.round(cropH * 0.12)
    let cx0 = Math.max(0, Math.min(workW - cropW, cxCenter - Math.floor(cropW / 2)))
    let cy0 = Math.max(0, py0 - topPad)
    const cy1 = Math.min(workH, cy0 + cropH)
    cy0 = Math.max(0, cy1 - cropH)
    cx0 = Math.max(0, Math.min(workW - cropW, cx0))

    // 4) 裁剪区域内按原始色距重建羽化 alpha 并合成新底色（边缘平滑过渡）
    const out = document.createElement('canvas')
    out.width = targetPxW
    out.height = targetPxH
    const octx = out.getContext('2d')!
    const blended = document.createElement('canvas')
    blended.width = cropW
    blended.height = cropH
    const bctx = blended.getContext('2d')!
    const outImg = bctx.createImageData(cropW, cropH)
    const od = outImg.data
    const feather = Math.max(6, tolerance * 0.35)
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const si = ((y + cy0) * workW + (x + cx0)) * 4
        const di = (y * cropW + x) * 4
        const dr = px[si] - bg[0]
        const dg = px[si + 1] - bg[1]
        const db = px[si + 2] - bg[2]
        let a = (Math.sqrt(dr * dr + dg * dg + db * db) - tolerance) / feather
        a = Math.max(0, Math.min(1, a))
        a = a * a * (3 - 2 * a) // smoothstep
        od[di] = px[si] * a + bg[0] * (1 - a)
        od[di + 1] = px[si + 1] * a + bg[1] * (1 - a)
        od[di + 2] = px[si + 2] * a + bg[2] * (1 - a)
        od[di + 3] = 255
      }
    }
    bctx.putImageData(outImg, 0, 0)
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(blended, 0, 0, cropW, cropH, 0, 0, targetPxW, targetPxH)
    const blob = await canvasToPng(out)
    return { blob, fileName: `${baseName}_idphoto.png` }
  } finally {
    bitmap.close()
  }
}

/**
 * 二维码浏览器引擎（后端离线兜底 = 手机网页版主通道）。
 *
 * 生成：node-qrcode(MIT) toCanvas——UTF-8 原生支持，参数与后端对齐
 * （scale=后端 box_size 每模块像素、margin=4、errorCorrectionLevel=ECC、dark/light 前后景色）。
 * 识别：jsQR(Apache-2.0) canvas 解码——attemptBoth 双极性；小图（<600px）2× 放大重试一次。
 *
 * 诚实边界（相对后端 zxing-cpp 的降级，UI 以 qrWebEngineNote 提示）：
 * 识别为单码（后端支持一图多码）；低清/模糊图无 CLAHE 对比度增强重试，清晰大图效果最佳。
 * 两依赖均动态 import()（Vite 代码分割），不进主包。
 */

export type QrEccLevel = 'L' | 'M' | 'Q' | 'H'

export interface QrWebReadResult {
  text: string
  format: string
}

/** 生成二维码 PNG（后端离线兜底）。boxSize=每模块像素（与后端 box_size 同义，钳制 2-40） */
export async function generateQrWeb(
  text: string,
  opts: { ecc: QrEccLevel; boxSize: number; dark: string; light: string },
): Promise<Blob> {
  if (!text.trim()) throw new Error('二维码内容为空')
  const QRCode = await import('qrcode')
  const canvas = document.createElement('canvas')
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: opts.ecc,
    scale: Math.min(40, Math.max(2, Math.round(opts.boxSize))),
    margin: 4,
    color: { dark: opts.dark, light: opts.light },
  })
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas-encode-failed'))),
      'image/png',
    )
  })
}

/** 识别图片中的二维码（后端离线兜底，单码）。无码返回 [] */
export async function readQrWeb(file: Blob): Promise<QrWebReadResult[]> {
  const jsQR = (await import('jsqr')).default
  // EXIF 方向解码：手机竖拍照片与拍照截图 Orientation 一致性靠 from-image
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const decodeAt = (scale: number) => {
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(bitmap, 0, 0, w, h)
      const img = ctx.getImageData(0, 0, w, h)
      return jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' })
    }
    // 大图先降到 1600px 工作分辨率；识别失败且原图偏小时 2× 放大重试（小图常见）
    const base = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    let code = decodeAt(base)
    if (!code && Math.min(bitmap.width, bitmap.height) < 600 && bitmap.width * 2 <= 4096 && bitmap.height * 2 <= 4096) {
      code = decodeAt(2)
    }
    if (!code) return []
    return [{ text: code.data, format: 'QR_CODE' }]
  } finally {
    bitmap.close()
  }
}

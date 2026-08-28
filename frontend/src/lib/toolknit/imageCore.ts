/**
 * 图像工坊核心 — 校验层按 ToolKnit image-batch-core.js / icon-gen-core.js 移植；
 * Canvas 操作（转换/压缩/裁剪/换色/拼接/图标/取色）按 ToolKnit 的工具语义实现
 * （其算法位于 Tauri UI 层，无法直接移植）。
 */

export const IMAGE_BATCH_LIMITS = Object.freeze({
  maxFiles: 100,
  maxBytesPerFile: 20 * 1024 * 1024,
  maxPixelsPerFile: 40_000_000,
});

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif']);
const COMPRESSIBLE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export type ImageBatchErrorCode =
  | 'missing_input' | 'too_many_files' | 'unsupported_input' | 'duplicate_input'
  | 'invalid_file_size' | 'file_too_large' | 'invalid_target_format'
  | 'invalid_compression_quality' | 'unsupported_compression_input';

export class ImageBatchError extends Error {
  code: ImageBatchErrorCode;
  constructor(code: ImageBatchErrorCode, message: string) {
    super(message);
    this.name = 'ImageBatchError';
    this.code = code;
  }
}

export function getImageExtension(fileName: string): string {
  if (typeof fileName !== 'string') return '';
  const match = /\.([^.\\/]+)$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

export function isSupportedImageFileName(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(getImageExtension(fileName));
}

export function isCompressibleImageFileName(fileName: string): boolean {
  return COMPRESSIBLE_EXTENSIONS.has(getImageExtension(fileName));
}

export function validateImageBatchSelection(files: File[]): File[] {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ImageBatchError('missing_input', 'Select at least one image file.');
  }
  if (files.length > IMAGE_BATCH_LIMITS.maxFiles) {
    throw new ImageBatchError('too_many_files', `A batch can contain at most ${IMAGE_BATCH_LIMITS.maxFiles} image files.`);
  }
  const seen = new Set<string>();
  files.forEach((file, index) => {
    const name = typeof file?.name === 'string' ? file.name.trim() : '';
    if (!name || !isSupportedImageFileName(name)) {
      throw new ImageBatchError('unsupported_input', `Unsupported image file at position ${index + 1}.`);
    }
    const identity = `file:${name}\u0000${file?.size ?? ''}`;
    if (seen.has(identity)) throw new ImageBatchError('duplicate_input', `Duplicate image file: ${name}`);
    seen.add(identity);
    if (file.size > IMAGE_BATCH_LIMITS.maxBytesPerFile) {
      throw new ImageBatchError('file_too_large', `Image file exceeds the ${IMAGE_BATCH_LIMITS.maxBytesPerFile}-byte limit.`);
    }
  });
  return files;
}

export function validateImageCompressionSelection(files: File[]): File[] {
  const validated = validateImageBatchSelection(files);
  validated.forEach((file, index) => {
    if (!isCompressibleImageFileName(file.name)) {
      throw new ImageBatchError('unsupported_compression_input', `Image format cannot be compressed safely at position ${index + 1}.`);
    }
  });
  return validated;
}

export type TargetFormat = 'jpg' | 'png' | 'webp';

// ===== Canvas 基础 =====

export async function loadImageBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas-encode-failed'))),
      mime,
      quality,
    );
  });
}

function drawSource(source: ImageBitmap | HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return canvas;
}

// ===== 格式转换 =====

const MIME: Record<TargetFormat, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function convertImage(file: File, target: TargetFormat): Promise<{ blob: Blob; fileName: string }> {
  validateImageBatchSelection([file]);
  const baseName = file.name.replace(/\.[^.\\/]+$/, '');
  const bitmap = await loadImageBitmap(file);
  const blob = await toBlob(drawSource(bitmap, bitmap.width, bitmap.height), MIME[target], target === 'png' ? undefined : 0.92);
  bitmap.close();
  return { blob, fileName: `${baseName}.${target}` };
}

// ===== 质量压缩 =====

export type CompressionQuality = 'high' | 'medium' | 'low';
const QUALITY_SETTINGS: Record<CompressionQuality, { quality: number; maxDimension: number }> = {
  high: { quality: 0.85, maxDimension: Number.POSITIVE_INFINITY },
  medium: { quality: 0.6, maxDimension: 2560 },
  low: { quality: 0.4, maxDimension: 1600 },
};

export async function compressImage(
  file: File,
  quality: CompressionQuality,
  outputFormat: 'jpg' | 'webp' = 'jpg',
): Promise<{ blob: Blob; fileName: string }> {
  validateImageCompressionSelection([file]);
  const settings = QUALITY_SETTINGS[quality];
  const bitmap = await loadImageBitmap(file);
  const scale = Math.min(1, settings.maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const blob = await toBlob(drawSource(bitmap, width, height), MIME[outputFormat], settings.quality);
  bitmap.close();
  const baseName = file.name.replace(/\.[^.\\/]+$/, '');
  return { blob, fileName: `${baseName}_${quality}.${outputFormat}` };
}

// ===== 裁剪 =====

export async function cropImage(
  file: File,
  rect: { x: number; y: number; width: number; height: number },
): Promise<{ blob: Blob; fileName: string }> {
  const bitmap = await loadImageBitmap(file);
  const { x, y, width, height } = rect;
  if (
    !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) ||
    width < 1 || height < 1 || x < 0 || y < 0 || x + width > bitmap.width || y + height > bitmap.height
  ) {
    bitmap.close();
    throw new ImageBatchError('invalid_file_size', 'Crop rectangle is outside the image bounds.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap as CanvasImageSource, Math.round(x), Math.round(y), Math.round(width), Math.round(height), 0, 0, canvas.width, canvas.height);
  const blob = await toBlob(canvas, 'image/png');
  bitmap.close();
  const baseName = file.name.replace(/\.[^.\\/]+$/, '');
  return { blob, fileName: `${baseName}_crop.png` };
}

// ===== 多通道色彩替换 =====

export interface ColorReplaceOptions {
  /** 十六进制颜色 #RRGGBB */
  from: string;
  to: string;
  /** 0-255 容差 */
  tolerance: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new ImageBatchError('invalid_target_format', 'Invalid hex color.');
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export async function replaceColor(file: File, options: ColorReplaceOptions): Promise<{ blob: Blob; fileName: string; replacedPixels: number }> {
  const [fr, fg, fb] = hexToRgb(options.from);
  const [tr, tg, tb] = hexToRgb(options.to);
  const bitmap = await loadImageBitmap(file);
  const canvas = drawSource(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const toleranceSq = options.tolerance * options.tolerance * 3;
  let replacedPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const dr = data[i] - fr;
    const dg = data[i + 1] - fg;
    const db = data[i + 2] - fb;
    if (dr * dr + dg * dg + db * db <= toleranceSq) {
      data[i] = tr;
      data[i + 1] = tg;
      data[i + 2] = tb;
      replacedPixels += 1;
    }
  }
  context.putImageData(imageData, 0, 0);
  const blob = await toBlob(canvas, 'image/png');
  const baseName = file.name.replace(/\.[^.\\/]+$/, '');
  return { blob, fileName: `${baseName}_recolored.png`, replacedPixels };
}

// ===== 多图拼接 =====

export type StitchDirection = 'horizontal' | 'vertical' | 'grid';

export async function stitchImages(files: File[], direction: StitchDirection, gap = 8): Promise<{ blob: Blob; fileName: string }> {
  if (files.length < 2) throw new ImageBatchError('missing_input', 'Select at least two images to stitch.');
  const bitmaps = await Promise.all(files.map((file) => loadImageBitmap(file)));
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    if (direction === 'horizontal') {
      const height = Math.max(...bitmaps.map((b) => b.height));
      const width = bitmaps.reduce((sum, b) => sum + b.width, 0) + gap * (bitmaps.length - 1);
      canvas.width = width;
      canvas.height = height;
      let x = 0;
      for (const bitmap of bitmaps) {
        context.drawImage(bitmap as CanvasImageSource, x, (height - bitmap.height) / 2);
        x += bitmap.width + gap;
      }
    } else if (direction === 'vertical') {
      const width = Math.max(...bitmaps.map((b) => b.width));
      const height = bitmaps.reduce((sum, b) => sum + b.height, 0) + gap * (bitmaps.length - 1);
      canvas.width = width;
      canvas.height = height;
      let y = 0;
      for (const bitmap of bitmaps) {
        context.drawImage(bitmap as CanvasImageSource, (width - bitmap.width) / 2, y);
        y += bitmap.height + gap;
      }
    } else {
      const columns = Math.ceil(Math.sqrt(bitmaps.length));
      const rows = Math.ceil(bitmaps.length / columns);
      const cellWidth = Math.max(...bitmaps.map((b) => b.width));
      const cellHeight = Math.max(...bitmaps.map((b) => b.height));
      canvas.width = columns * cellWidth + gap * (columns - 1);
      canvas.height = rows * cellHeight + gap * (rows - 1);
      bitmaps.forEach((bitmap, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        context.drawImage(
          bitmap as CanvasImageSource,
          column * (cellWidth + gap),
          row * (cellHeight + gap),
        );
      });
    }
    const blob = await toBlob(canvas, 'image/png');
    return { blob, fileName: `stitched_${direction}.png` };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

// ===== 应用图标生成 =====

export const ICON_SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512] as const;

export async function generateIcons(file: File): Promise<{ size: number; blob: Blob; fileName: string }[]> {
  const bitmap = await loadImageBitmap(file);
  try {
    const outputs: { size: number; blob: Blob; fileName: string }[] = [];
    for (const size of ICON_SIZES) {
      const canvas = drawSource(bitmap, size, size);
      const blob = await toBlob(canvas, 'image/png');
      outputs.push({ size, blob, fileName: `icon_${size}x${size}.png` });
    }
    return outputs;
  } finally {
    bitmap.close();
  }
}

// ===== 主题取色（k-means 聚类） =====

export interface PaletteColor {
  hex: string;
  ratio: number;
}

export async function extractPalette(file: File, colorCount = 6): Promise<PaletteColor[]> {
  const bitmap = await loadImageBitmap(file);
  const sampleWidth = Math.min(160, bitmap.width);
  const sampleHeight = Math.max(1, Math.round((bitmap.height / bitmap.width) * sampleWidth));
  const canvas = drawSource(bitmap, sampleWidth, sampleHeight);
  bitmap.close();
  const { data } = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, sampleWidth, sampleHeight);

  const samples: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (!samples.length) return [];

  let centroids = samples.filter((_, i) => i % Math.max(1, Math.floor(samples.length / colorCount)) === 0).slice(0, colorCount);
  const assignments = new Array<number>(samples.length).fill(0);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    for (let s = 0; s < samples.length; s += 1) {
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let c = 0; c < centroids.length; c += 1) {
        const dr = samples[s][0] - centroids[c][0];
        const dg = samples[s][1] - centroids[c][1];
        const db = samples[s][2] - centroids[c][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      assignments[s] = best;
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let s = 0; s < samples.length; s += 1) {
      const a = assignments[s];
      sums[a][0] += samples[s][0];
      sums[a][1] += samples[s][1];
      sums[a][2] += samples[s][2];
      sums[a][3] += 1;
    }
    centroids = centroids.map((centroid, c) =>
      sums[c][3] > 0
        ? [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]]
        : centroid,
    );
  }

  const counts = new Array<number>(centroids.length).fill(0);
  assignments.forEach((a) => {
    counts[a] += 1;
  });
  const palette = centroids
    .map((centroid, c) => ({
      hex:
        '#' +
        centroid
          .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
          .join(''),
      ratio: counts[c] / samples.length,
    }))
    .sort((a, b) => b.ratio - a.ratio);
  // 合并收敛到同色的重复质心
  const merged = new Map<string, number>();
  for (const color of palette) {
    merged.set(color.hex, (merged.get(color.hex) ?? 0) + color.ratio);
  }
  return [...merged.entries()]
    .map(([hex, ratio]) => ({ hex, ratio }))
    .sort((a, b) => b.ratio - a.ratio);
}

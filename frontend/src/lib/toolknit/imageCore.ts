import JSZip from 'jszip';

export interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  pixels: number;
  percentage: number;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === rn) hue = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) hue = ((bn - rn) / delta + 2) / 6;
    else hue = ((rn - gn) / delta + 4) / 6;
  }
  return {
    h: Math.round(hue * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  };
}

export async function extractPaletteFromImage(file: File, count: number = 6): Promise<ExtractedColor[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        const maxSide = 200;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get canvas context');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();
        let validPixels = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const a = imageData[i + 3];
          if (a < 128) continue;
          const r = Math.round(imageData[i] / 16) * 16;
          const g = Math.round(imageData[i + 1] / 16) * 16;
          const b = Math.round(imageData[i + 2] / 16) * 16;
          const key = `${r},${g},${b}`;
          const existing = colorMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorMap.set(key, { r, g, b, count: 1 });
          }
          validPixels++;
        }

        const sorted = Array.from(colorMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, count);

        const result: ExtractedColor[] = sorted.map(c => {
          return {
            hex: rgbToHex(c.r, c.g, c.b),
            rgb: { r: c.r, g: c.g, b: c.b },
            hsl: rgbToHsl(c.r, c.g, c.b),
            pixels: c.count,
            percentage: validPixels > 0 ? Number(((c.count / validPixels) * 100).toFixed(1)) : 0
          };
        });

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export async function stitchImages(
  files: { file: File; width: number; height: number }[],
  options: {
    mode: 'vertical' | 'horizontal';
    spacing: number;
    background: string;
    format: 'png' | 'jpeg';
    quality: number;
  }
): Promise<Blob> {
  const images = await Promise.all(
    files.map(f => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(f.file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    }))
  );

  const canvas = document.createElement('canvas');
  const spacing = options.spacing || 0;

  if (options.mode === 'vertical') {
    const maxWidth = Math.max(...images.map(img => img.width));
    const totalHeight = images.reduce((sum, img) => sum + img.height, 0) + spacing * (images.length - 1);
    canvas.width = maxWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');
    ctx.fillStyle = options.background || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentY = 0;
    for (const img of images) {
      const x = (maxWidth - img.width) / 2;
      ctx.drawImage(img, x, currentY);
      currentY += img.height + spacing;
    }
  } else {
    const maxHeight = Math.max(...images.map(img => img.height));
    const totalWidth = images.reduce((sum, img) => sum + img.width, 0) + spacing * (images.length - 1);
    canvas.width = totalWidth;
    canvas.height = maxHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');
    ctx.fillStyle = options.background || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentX = 0;
    for (const img of images) {
      const y = (maxHeight - img.height) / 2;
      ctx.drawImage(img, currentX, y);
      currentX += img.width + spacing;
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Stitch export failed'));
    }, options.format === 'jpeg' ? 'image/jpeg' : 'image/png', options.quality / 100);
  });
}

export function buildIcoBuffer(pngBlobsWithSizes: { size: number; bytes: Uint8Array }[]): Uint8Array {
  const count = pngBlobsWithSizes.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  let totalSize = offset;
  for (const item of pngBlobsWithSizes) {
    totalSize += item.bytes.length;
  }

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);

  for (let i = 0; i < count; i++) {
    const { size, bytes } = pngBlobsWithSizes[i];
    const entryOffset = headerSize + i * dirEntrySize;
    view.setUint8(entryOffset + 0, size >= 256 ? 0 : size);
    view.setUint8(entryOffset + 1, size >= 256 ? 0 : size);
    view.setUint8(entryOffset + 2, 0);
    view.setUint8(entryOffset + 3, 0);
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, bytes.length, true);
    view.setUint32(entryOffset + 12, offset, true);

    const u8 = new Uint8Array(buffer, offset, bytes.length);
    u8.set(bytes);
    offset += bytes.length;
  }

  return new Uint8Array(buffer);
}

export async function generateIcons(
  file: File,
  sizes: number[] = [16, 32, 48, 64, 128, 256]
): Promise<{ zipBlob: Blob; icoBlob: Blob; previews: { size: number; url: string }[] }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = url;
  });

  const zip = new JSZip();
  const pngDataList: { size: number; bytes: Uint8Array }[] = [];
  const previews: { size: number; url: string }[] = [];

  for (const size of sizes) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
      if (blob) {
        const buffer = await blob.arrayBuffer();
        const u8 = new Uint8Array(buffer);
        pngDataList.push({ size, bytes: u8 });
        zip.file(`icon-${size}x${size}.png`, u8);
        previews.push({ size, url: URL.createObjectURL(blob) });
      }
    }
  }

  const icoU8 = buildIcoBuffer(pngDataList);
  const icoBlob = new Blob([icoU8.buffer as ArrayBuffer], { type: 'image/x-icon' });
  zip.file('favicon.ico', icoU8);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { zipBlob, icoBlob, previews };
}

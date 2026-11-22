/**
 * Client-side player photo compressor: center-crop to a square, resize to
 * 256x256 and encode as WebP (JPEG fallback on browsers without WebP encoding,
 * e.g. older Safari) at quality 0.8 => ~15–25 KB data URL stored on the Player.
 */

export const AVATAR_SIZE = 256;
export const AVATAR_QUALITY = 0.8;
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export interface CropRect {
  sx: number;
  sy: number;
  size: number;
}

/** Pure: largest centered square inside a width x height image. */
export function centerSquareCrop(width: number, height: number): CropRect {
  const size = Math.min(width, height);
  return { sx: Math.round((width - size) / 2), sy: Math.round((height - size) / 2), size };
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall back to <img> (e.g. HEIC handled by Safari's decoder) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new Error('This image format could not be read. Try a JPG or PNG photo.', { cause: err });
  }
}

export async function compressAvatar(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/') && file.type !== '') throw new Error('Please choose an image file.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Image is larger than 25 MB.');
  const { source, width, height, close } = await decode(file);
  try {
    const { sx, sy, size } = centerSquareCrop(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff'; // JPEG has no alpha: flatten transparent PNGs onto white
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(source, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    const webp = canvas.toDataURL('image/webp', AVATAR_QUALITY);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', AVATAR_QUALITY);
  } finally {
    close();
  }
}

/** Approximate decoded size of a data URL in bytes. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

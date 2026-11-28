/**
 * Client-side image compressors (WebP, transparency kept; JPEG on white where WebP encoding is missing):
 * profile picture 256x256 square crop, team logo fitted into 256x256, FUT card photo with its proportions.
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

/** WebP keeps transparency (cut-out photos, logos). Browsers without WebP encoding get JPEG on white. */
function encode(canvas: HTMLCanvasElement, quality: number): string {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return webp;
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat.toDataURL('image/jpeg', quality);
}

type Draw = (width: number, height: number) => { canvas: [number, number]; src?: CropRect; dst: [number, number, number, number] };

async function render(file: Blob, plan: Draw, quality: number): Promise<string> {
  if (!file.type.startsWith('image/') && file.type !== '') throw new Error('Please choose an image file.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Image is larger than 25 MB.');
  const { source, width, height, close } = await decode(file);
  try {
    const { canvas: [cw, ch], src, dst } = plan(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (src) ctx.drawImage(source, src.sx, src.sy, src.size, src.size, ...dst);
    else ctx.drawImage(source, ...dst);
    return encode(canvas, quality);
  } finally {
    close();
  }
}

/** Round profile picture: center square crop, 256 x 256 (transparency kept). */
export const compressAvatar = (file: Blob): Promise<string> =>
  render(file, (w, h) => ({ canvas: [AVATAR_SIZE, AVATAR_SIZE], src: centerSquareCrop(w, h), dst: [0, 0, AVATAR_SIZE, AVATAR_SIZE] }), AVATAR_QUALITY);

/**
 * Profile picture cut from a FUT photo (head and shoulders, face about 40 % from the top, centered):
 * so one photo per player is enough.
 */
export const compressAvatarFromBust = (file: Blob): Promise<string> =>
  render(
    file,
    (w, h) => {
      const size = Math.min(w, Math.round(h * 0.76));
      const sy = Math.min(Math.max(0, Math.round(h * 0.4 - size / 2)), h - size);
      return { canvas: [AVATAR_SIZE, AVATAR_SIZE], src: { sx: Math.round((w - size) / 2), sy, size }, dst: [0, 0, AVATAR_SIZE, AVATAR_SIZE] };
    },
    AVATAR_QUALITY,
  );

/** Team logo: the whole logo fitted into 256 x 256 (never cropped, so wide or non-round logos survive), transparent padding. */
export const compressLogo = (file: Blob): Promise<string> =>
  render(
    file,
    (w, h) => {
      const k = Math.min(AVATAR_SIZE / w, AVATAR_SIZE / h);
      const dw = Math.round(w * k);
      const dh = Math.round(h * k);
      return { canvas: [AVATAR_SIZE, AVATAR_SIZE], dst: [Math.round((AVATAR_SIZE - dw) / 2), Math.round((AVATAR_SIZE - dh) / 2), dw, dh] };
    },
    0.9,
  );

export const FUT_PHOTO_MAX = 720;

/** FUT card photo: keeps the proportions, at most 720 px on the long side (transparency kept). */
export const compressFutPhoto = (file: Blob): Promise<string> =>
  render(
    file,
    (w, h) => {
      const k = Math.min(1, FUT_PHOTO_MAX / Math.max(w, h));
      const dw = Math.round(w * k);
      const dh = Math.round(h * k);
      return { canvas: [dw, dh], dst: [0, 0, dw, dh] };
    },
    0.85,
  );

/** Approximate decoded size of a data URL in bytes. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

export const CARD_ART_MAX_BYTES = 300 * 1024;

/** Power card picture: cover-cropped (centered) to the art window `size` (w x h), WebP, shrunk until it fits ~300 KB. */
export async function compressCardArt(file: Blob, [w, h]: [number, number]): Promise<string> {
  let out = '';
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    out = await render(
      file,
      (sw, sh) => {
        const k = Math.max(w / sw, h / sh);
        const dw = Math.round(sw * k);
        const dh = Math.round(sh * k);
        return { canvas: [w, h], dst: [Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh] };
      },
      quality,
    );
    if (dataUrlBytes(out) <= CARD_ART_MAX_BYTES) break;
  }
  return out;
}

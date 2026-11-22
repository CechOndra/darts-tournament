/**
 * Optional Canva overrides in /public/custom-cards/ (fut-bronze.png, fut-gold.png, <CARD_ID>.png ...).
 * Loaded as data URLs so they also render inside exported SVG -> PNG images.
 */
const cache = new Map<string, Promise<string | null>>();

export function loadCustomAsset(file: string): Promise<string | null> {
  let p = cache.get(file);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}custom-cards/${file}`)
      .then(async (r) => {
        const type = r.headers.get('content-type') ?? '';
        if (!r.ok || !type.startsWith('image/')) return null;
        const blob = await r.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      })
      .catch(() => null);
    cache.set(file, p);
  }
  return p;
}

/** Resolve theme tokens to literal colors (exported SVGs cannot see CSS variables). */
export function themeColor(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}

/** Download an <svg> element as a PNG at its viewBox size (x scale). */
export async function downloadSvgAsPng(svg: SVGSVGElement, fileName: string, scale = 1): Promise<void> {
  const vb = svg.viewBox.baseVal;
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the card'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = vb.width * scale;
    canvas.height = vb.height * scale;
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('PNG export failed');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(png);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

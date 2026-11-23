import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** QR code for a URL (rendered on a light square so phone cameras read it on dark screens). */
export function QrCode({ url, size = 200, label = 'QR code' }: { url: string; size?: number; label?: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [url]);
  return <div className="shrink-0 rounded-md bg-print-paper p-1" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} aria-label={label} role="img" />;
}

/**
 * ID helpers that also work on plain-HTTP LAN origins (http://192.168.x.x),
 * where crypto.randomUUID() is unavailable because the context is not secure.
 */
export function createId(prefix = ''): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${hex}` : hex;
}

const CLIENT_ID_KEY = 'darts.clientId';

/** Stable per-tab client id (survives refresh, distinct per tab/device). */
export function getClientId(): string {
  try {
    const existing = globalThis.sessionStorage?.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const id = createId('client');
    globalThis.sessionStorage?.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return createId('client');
  }
}

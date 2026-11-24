/**
 * Sound overrides: the admin can swap a built-in sound for an uploaded mp3.
 * Stored in this browser's IndexedDB (survives refresh, never leaves the device);
 * a BroadcastChannel tells other tabs of the same browser (e.g. the stage) to reload.
 * Slot keys: 'win', 'crowd:<id>', 'meme:<file>'.
 */

const DB = 'darts-sound-overrides';
const STORE = 'blobs';
const urls = new Map<string, string>();
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(DB) : null;

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function reload(): Promise<void> {
  try {
    const store = (await db()).transaction(STORE).objectStore(STORE);
    const keys = (await done(store.getAllKeys())) as string[];
    const blobs = (await done(store.getAll())) as Blob[];
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.clear();
    keys.forEach((k, i) => urls.set(k, URL.createObjectURL(blobs[i]!)));
  } catch {
    // IndexedDB unavailable (private mode): overrides simply don't exist
  }
  listeners.forEach((l) => l());
}

if (channel) channel.onmessage = () => void reload();
void reload();

export const overrideUrl = (slot: string): string | null => urls.get(slot) ?? null;
export const hasOverride = (slot: string): boolean => urls.has(slot);

export function onOverridesChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function setOverride(slot: string, file: Blob): Promise<void> {
  await done((await db()).transaction(STORE, 'readwrite').objectStore(STORE).put(file, slot));
  channel?.postMessage(slot);
  await reload();
}

export async function clearOverride(slot: string): Promise<void> {
  await done((await db()).transaction(STORE, 'readwrite').objectStore(STORE).delete(slot));
  channel?.postMessage(slot);
  await reload();
}

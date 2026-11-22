import type { CardRarity } from '../../engine/cardCatalog.ts';

/**
 * Stage sound: generated Web Audio effects (no files) plus the match-win song.
 * Browsers only allow sound after a user gesture on the page, so the stage
 * calls unlockAudio() on the first click/tap. Mute is stored per device.
 */

const MUTE_KEY = 'darts.sound.muted';
let ctx: AudioContext | null = null;
let winSong: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore (private mode)
  }
  if (muted) winSong?.pause();
  listeners.forEach((l) => l());
}

export function isAudioUnlocked(): boolean {
  return !!ctx && ctx.state === 'running';
}

export function onAudioChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Call from a click/tap handler: resumes the audio context and preloads the win song. */
export async function unlockAudio(): Promise<void> {
  const c = audio();
  if (c && c.state !== 'running') await c.resume().catch(() => undefined);
  if (!winSong) {
    winSong = new Audio(`${import.meta.env.BASE_URL}audio/game-win.mp3`);
    winSong.preload = 'auto';
  }
  listeners.forEach((l) => l());
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.2): void {
  const c = audio();
  if (!c || c.state !== 'running' || isMuted()) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Metallic tick for each case tile / wheel peg passing the marker. */
export function playTick(): void {
  tone(2200, 0, 0.04, 'square', 0.05);
  tone(3300, 0, 0.03, 'triangle', 0.04);
}

/** Card reveal fanfare, grander for rarer cards. */
export function playReveal(rarity: CardRarity): void {
  const notes: Record<CardRarity, number[]> = {
    COMMON: [523, 659],
    SILVER: [523, 659, 784],
    RARE: [523, 659, 784, 1047],
    LEGENDARY: [392, 523, 659, 784, 1047, 1319],
  };
  notes[rarity].forEach((f, i) => tone(f, i * 0.11, rarity === 'LEGENDARY' ? 0.9 : 0.5, 'triangle', 0.18));
}

/** Short stinger when a card is played. */
export function playCardStinger(): void {
  tone(196, 0, 0.25, 'sawtooth', 0.08);
  tone(392, 0.08, 0.35, 'triangle', 0.15);
}

/** Shot clock beep (higher in the last seconds). */
export function playCountdown(final: boolean): void {
  tone(final ? 1320 : 880, 0, final ? 0.5 : 0.12, 'square', 0.08);
}

/** Match-winning dart: play the win song from the start. */
export function playWinSong(): void {
  if (isMuted() || !isAudioUnlocked()) return;
  if (!winSong) winSong = new Audio(`${import.meta.env.BASE_URL}audio/game-win.mp3`);
  winSong.currentTime = 0;
  winSong.volume = 0.9;
  void winSong.play().catch(() => undefined);
}

export function stopWinSong(): void {
  winSong?.pause();
}

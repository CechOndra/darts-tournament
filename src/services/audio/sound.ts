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

// ------------------------------------------------------------------ crowd soundboard (generated)

function noiseBurst(start: number, duration: number, filterFreq: number, gain = 0.25, q = 0.7): void {
  const c = audio();
  if (!c || c.state !== 'running' || isMuted()) return;
  const len = Math.max(1, Math.floor(c.sampleRate * duration));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + start);
}

function glide(from: number, to: number, start: number, duration: number, type: OscillatorType, gain: number): void {
  const c = audio();
  if (!c || c.state !== 'running' || isMuted()) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

type CrowdId = 'AIRHORN' | 'APPLAUSE' | 'DRUMROLL' | 'OOOH' | 'BOO' | 'FANFARE';

/** Optional real recordings: public/sounds/airhorn.mp3, applause.mp3, ... replace the synthesized versions. */
const crowdFiles = new Map<CrowdId, Promise<HTMLAudioElement | null>>();
function crowdFile(id: CrowdId): Promise<HTMLAudioElement | null> {
  let p = crowdFiles.get(id);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}sounds/${id.toLowerCase()}.mp3`;
    p = fetch(url, { method: 'HEAD' })
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio') ? new Audio(url) : null))
      .catch(() => null);
    crowdFiles.set(id, p);
  }
  return p;
}

/** Crowd soundboard: a dropped-in mp3 if present, otherwise a synthesized effect. */
export function playCrowdSound(id: CrowdId): void {
  if (isMuted() || !isAudioUnlocked()) return;
  void crowdFile(id).then((file) => {
    if (!file) return synthCrowd(id);
    file.currentTime = 0;
    void file.play().catch(() => synthCrowd(id));
  });
}

function synthCrowd(id: CrowdId): void {
  switch (id) {
    case 'AIRHORN':
      for (const [s, d] of [[0, 0.35], [0.45, 0.35], [0.9, 0.9]] as const) {
        tone(466, s, d, 'sawtooth', 0.12);
        tone(587, s, d, 'sawtooth', 0.1);
        tone(698, s, d, 'sawtooth', 0.08);
      }
      break;
    case 'APPLAUSE':
      for (let i = 0; i < 40; i++) noiseBurst(Math.random() * 2.2, 0.06 + Math.random() * 0.05, 1500 + Math.random() * 2500, 0.35);
      break;
    case 'DRUMROLL':
      for (let i = 0; i < 36; i++) noiseBurst(i * 0.055, 0.05, 220, 0.5 + i * 0.01, 1.5);
      tone(110, 2.0, 0.5, 'triangle', 0.3);
      noiseBurst(2.0, 0.6, 5000, 0.4, 0.4);
      break;
    case 'OOOH':
      glide(330, 220, 0, 1.6, 'sine', 0.2);
      glide(415, 277, 0, 1.6, 'sine', 0.12);
      break;
    case 'BOO':
      glide(160, 110, 0, 1.8, 'sawtooth', 0.12);
      glide(200, 130, 0.05, 1.8, 'sawtooth', 0.08);
      break;
    case 'FANFARE':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.14, i === 5 ? 0.8 : 0.18, 'square', 0.08));
      break;
  }
}

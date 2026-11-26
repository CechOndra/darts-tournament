import { overrideUrl } from './overrides.ts';
import { isMuted } from './sound.ts';

/**
 * Score caller. A referee clip (public/callouts/<score>.mp3 or an admin upload) is played when it
 * exists; otherwise, and for the "you require" line, the stage browser's built-in voice (Web Speech
 * API) speaks. Runs on the stage PC only, no extra load on the app.
 */
const VOICE_KEY = 'darts.caller.voice';
const RATE_KEY = 'darts.caller.rate';
let voice: SpeechSynthesisVoice | null | undefined;

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore (private mode)
  }
};

export const callerVoices = (): SpeechSynthesisVoice[] => (typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices());
export const callerVoiceName = (): string => read(VOICE_KEY) ?? '';
export const callerRate = (): number => Math.min(1.6, Math.max(0.6, Number(read(RATE_KEY)) || 1));
export function setCallerVoice(name: string): void {
  write(VOICE_KEY, name);
  voice = undefined;
}
export const setCallerRate = (rate: number): void => write(RATE_KEY, String(rate));

function pickVoice(): SpeechSynthesisVoice | null {
  if (voice) return voice;
  const all = callerVoices();
  const chosen = callerVoiceName();
  // The admin's choice wins; otherwise a British English voice sounds most like a darts caller.
  voice =
    all.find((v) => v.name === chosen) ??
    all.find((v) => v.lang === 'en-GB' && /male|daniel|george|ryan/i.test(v.name)) ??
    all.find((v) => v.lang === 'en-GB') ??
    all.find((v) => v.lang.startsWith('en')) ??
    null;
  return voice;
}

export function speak(lines: string[]): void {
  if (!lines.length || isMuted() || typeof speechSynthesis === 'undefined') return;
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-GB';
    u.rate = callerRate() * (line.includes('eighty') ? 0.9 : 1);
    u.pitch = 1;
    u.volume = 1;
    speechSynthesis.speak(u);
  }
}

const clipExists = new Map<string, Promise<string | null>>();
function calloutClip(key: string): Promise<string | null> {
  const custom = overrideUrl(`callout:${key}`);
  if (custom) return Promise.resolve(custom);
  let p = clipExists.get(key);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}callouts/${key}.mp3`;
    p = fetch(url, { method: 'HEAD' })
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio') ? url : null))
      .catch(() => null);
    clipExists.set(key, p);
  }
  return p;
}

/**
 * Announce a finished visit. `lines` are the voice lines (first = the score itself);
 * with a clip the score line is skipped and the rest only follows when `requireAfterClip`.
 */
export async function callScore(key: string, lines: string[], requireAfterClip: boolean): Promise<void> {
  if (!lines.length || isMuted()) return;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  const url = await calloutClip(key);
  if (!url) return speak(lines);
  const rest = requireAfterClip ? lines.slice(1) : [];
  const clip = new Audio(url);
  clip.onended = () => speak(rest);
  clip.play().catch(() => speak(lines));
}

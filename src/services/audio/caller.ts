import { isMuted } from './sound.ts';

/**
 * Score caller using the stage browser's built-in voice (Web Speech API): runs on the
 * stage PC only, no network and no extra load on the app.
 */
let voice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined && voice !== null) return voice;
  const all = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
  // A British English voice sounds most like a darts caller; fall back to any English voice.
  voice = all.find((v) => v.lang === 'en-GB' && /male|daniel|george|ryan/i.test(v.name)) ?? all.find((v) => v.lang === 'en-GB') ?? all.find((v) => v.lang.startsWith('en')) ?? null;
  return voice;
}

export function callOut(lines: string[]): void {
  if (!lines.length || isMuted() || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-GB';
    u.rate = line.includes('eighty') ? 0.85 : 0.95;
    u.pitch = 0.9;
    u.volume = 1;
    speechSynthesis.speak(u);
  }
}

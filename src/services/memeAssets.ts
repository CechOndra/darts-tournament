import { overrideUrl } from './audio/overrides.ts';
import { isAudioUnlocked, isMuted } from './audio/sound.ts';

/** Meme files in public/memes/: user images win over the shipped .svg placeholders. */
const IMAGE_EXTS = ['png', 'jpg', 'gif', 'webp', 'svg'];
const imageCache = new Map<string, Promise<string | null>>();
const soundCache = new Map<string, Promise<string | null>>();

async function exists(url: string, kind: 'image' | 'audio'): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok && (r.headers.get('content-type') ?? '').startsWith(kind);
  } catch {
    return false;
  }
}

export function memeImage(file: string): Promise<string | null> {
  let p = imageCache.get(file);
  if (!p) {
    p = (async () => {
      for (const ext of IMAGE_EXTS) {
        const url = `${import.meta.env.BASE_URL}memes/${file}.${ext}`;
        if (await exists(url, 'image')) return url;
      }
      return null;
    })();
    imageCache.set(file, p);
  }
  return p;
}

function memeSound(file: string): Promise<string | null> {
  let p = soundCache.get(file);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}memes/${file}.mp3`;
    p = exists(url, 'audio').then((ok) => (ok ? url : null));
    soundCache.set(file, p);
  }
  return p;
}

/** The meme's mp3 if there is one, otherwise (optionally) the caption read aloud. */
export async function playMemeAudio(file: string, caption: string, speech: boolean): Promise<void> {
  if (isMuted() || !isAudioUnlocked()) return;
  const sound = overrideUrl(`meme:${file}`) ?? (await memeSound(file));
  if (sound) {
    void new Audio(sound).play().catch(() => undefined);
    return;
  }
  if (speech && typeof speechSynthesis !== 'undefined') {
    // Queue after the score caller instead of cutting it off.
    speechSynthesis.speak(new SpeechSynthesisUtterance(caption));
  }
}

export const MEME_TEST_EVENT = 'MEME_TEST';


import { MonitorPlay } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Field, Toggle } from '../../../components/ui.tsx';
import { MEMES, memeSettings, type MemeId } from '../../../engine/memes.ts';
import type { TournamentState } from '../../../engine/state.ts';
import { useDispatch, useTransportContext } from '../../../hooks/TransportProvider.tsx';
import { MEME_TEST_EVENT, memeImage } from '../../../services/memeAssets.ts';

function Thumb({ file }: { file: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void memeImage(file).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [file]);
  return url ? <img src={url} alt="" className="h-14 w-20 shrink-0 rounded border border-border-subtle object-cover" /> : <span className="h-14 w-20 shrink-0 rounded bg-bg-primary" />;
}

/** Stage meme overlays: on/off, which memes, how long, spoken captions, and a test button. */
export function MemesSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const { transport } = useTransportContext();
  const s = memeSettings(state);
  const set = (patch: Partial<typeof s>) => void dispatch({ type: 'UPDATE_MEME_SETTINGS', patch }, { persist: 'immediate' });
  const toggle = (id: MemeId, on: boolean) => set({ off: on ? s.off.filter((x) => x !== id) : [...s.off, id] });

  return (
    <div className="space-y-3">
      <Toggle label="Memes on the stage" description="Pop up after the visit that triggers them (bottom right, the score stays visible)." checked={s.enabled} onChange={(enabled) => set({ enabled })} />
      <Toggle label="Read captions aloud" description="Uses the stage browser's voice when a meme has no mp3 of its own." checked={s.speech} onChange={(speech) => set({ speech })} />
      <Field label="Seconds on screen">
        {(id) => (
          <input
            id={id}
            type="number"
            min={2}
            max={15}
            value={s.seconds}
            onChange={(e) => set({ seconds: Math.min(15, Math.max(2, Number(e.target.value) || 5)) })}
            className="min-h-11 w-28 rounded-md border border-border-subtle bg-bg-primary px-3 text-base"
          />
        )}
      </Field>
      <ul className="space-y-1.5">
        {MEMES.map((m) => (
          <li key={m.id} className={`flex items-center gap-3 rounded-md bg-bg-primary p-2 ${s.off.includes(m.id) ? 'opacity-50' : ''}`}>
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--accent-gold)]" checked={!s.off.includes(m.id)} onChange={(e) => toggle(m.id, e.target.checked)} aria-label={`${m.name} on`} />
            <Thumb file={m.file} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{m.name}</span>
              <span className="block truncate text-xs text-text-muted">
                {m.trigger} · <span className="font-mono">memes/{m.file}.png</span>
              </span>
            </span>
            <Button size="sm" icon={MonitorPlay} title="Show it on the stage now" onClick={() => void transport.emitLiveEvent(MEME_TEST_EVENT, { id: m.id })}>
              Test
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">
        Replace the placeholders by putting your images in <span className="font-mono">public/memes/</span> with the names above (png, jpg, gif or webp), or send them to me.
      </p>
    </div>
  );
}

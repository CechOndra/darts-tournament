import { Upload, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { callerRate, callerVoiceName, callerVoices, setCallerRate, setCallerVoice, speak } from '../../../services/audio/caller.ts';
import { Button } from '../../../components/ui.tsx';
import { MEMES } from '../../../engine/memes.ts';
import { clearOverride, hasOverride, onOverridesChange, setOverride } from '../../../services/audio/overrides.ts';

const SLOTS = [
  { key: 'win', name: 'Match win song', hint: 'audio/game-win.mp3' },
  ...['airhorn', 'applause', 'drumroll', 'oooh', 'boo', 'fanfare'].map((id) => ({ key: `crowd:${id}`, name: `Crowd: ${id}`, hint: `sounds/${id}.mp3` })),
  ...['180', '140', '100', 'noscore', 'gameshot-leg', 'gameshot-match'].map((k) => ({ key: `callout:${k}`, name: `Callout: ${k}`, hint: `callouts/${k}.mp3` })),
  ...MEMES.map((m) => ({ key: `meme:${m.file}`, name: `Meme: ${m.name}`, hint: `memes/${m.file}.mp3` })),
];

// Re-render on any change; the version string changes whenever an override is added/removed.
const version = () => SLOTS.map((s) => (hasOverride(s.key) ? '1' : '0')).join('');

function Slot({ slot }: { slot: (typeof SLOTS)[number] }) {
  const input = useRef<HTMLInputElement>(null);
  const custom = useSyncExternalStore(onOverridesChange, () => hasOverride(slot.key));
  return (
    <li className="flex items-center gap-3 rounded-md bg-bg-primary p-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{slot.name}</span>
        <span className="block truncate text-xs text-text-muted">{custom ? 'Using your uploaded file' : `Default: ${slot.hint}`}</span>
      </span>
      <input ref={input} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void setOverride(slot.key, f); e.target.value = ''; }} />
      <Button size="sm" icon={Upload} onClick={() => input.current?.click()}>Upload</Button>
      {custom && <Button size="sm" icon={Undo2} onClick={() => void clearOverride(slot.key)}>Use default</Button>}
    </li>
  );
}

/** Computer voice of the score caller (e.g. a Czech one for Czech names) and its speed; saved per browser. */
function VoicePicker() {
  const [voices, setVoices] = useState(callerVoices);
  const [name, setName] = useState(callerVoiceName);
  const [rate, setRate] = useState(callerRate);
  useEffect(() => {
    const update = () => setVoices(callerVoices());
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-bg-primary p-2">
      <span className="w-full text-sm font-semibold">Caller computer voice (used when a score has no clip)</span>
      <select
        className="min-h-11 min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-surface px-3 text-base"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setCallerVoice(e.target.value);
        }}
        aria-label="Caller voice"
      >
        <option value="">Automatic (British English)</option>
        {voices.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name} ({v.lang})
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        Speed
        <input
          type="range"
          min={0.6}
          max={1.6}
          step={0.05}
          value={rate}
          onChange={(e) => {
            setRate(Number(e.target.value));
            setCallerRate(Number(e.target.value));
          }}
        />
      </label>
      <Button size="sm" onClick={() => speak(['One hundred and eighty!', 'Čech, you require 40'])}>
        Test
      </Button>
    </div>
  );
}

/** Swap any built-in sound for an mp3 from this device (same browser as the stage). */
export function SoundsSection() {
  useSyncExternalStore(onOverridesChange, version);
  return (
    <div className="space-y-3">
      <VoicePicker />
      <ul className="space-y-1.5">{SLOTS.map((s) => <Slot key={s.key} slot={s} />)}</ul>
      <p className="text-xs text-text-muted">
        Uploads are saved in this browser only, so they work when the stage runs in the same browser as this admin page. "Use default" goes back to the file published with the site.
      </p>
    </div>
  );
}

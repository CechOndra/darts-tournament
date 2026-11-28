import { ImageOff, RotateCcw, Save, Upload } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CARD_TYPES, type CardTypeId } from '../../engine/cardCatalog.ts';
import type { CardSettings, CardStyle } from '../../engine/types.ts';
import { PRESET, renderCard } from '../../powercards/power-card.js';
import { compressCardArt } from '../../services/media/photoCompressor.ts';
import { renderData, resolveStyle, type RendererRarity } from '../cards/cardView.ts';
import { PowerCard } from '../cards/PowerCard.tsx';
import { Button, Field, Notice, SegmentedControl } from '../ui.tsx';

const LOOKS: [string, string][] = [['flat', 'Flat'], ['arcade', 'Arcade'], ['premium', 'Premium'], ['classic', 'Classic']];
const TIER_LABEL: Record<string, string> = { all: 'All cards', common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };
// what each look uses when nothing is set (picker start values), as in the card playground
const NAVY = { common: '#294466', uncommon: '#1e4684', rare: '#17488f', legendary: '#17488f' };
const BODY: Record<string, Record<string, string>> = { arcade: NAVY, premium: NAVY, flat: { common: '#1d1e23', uncommon: '#1d1e23', rare: '#3a1d4f', legendary: '#5e5f16' }, classic: { common: '#17488f', uncommon: '#17488f', rare: '#17488f', legendary: '#17488f' } };
const EDGE: Record<string, string> = { common: '#dbe6f3', uncommon: '#5fe6ff', rare: '#ffd24d', legendary: '#ff7a1a' };
const FLATEDGE: Record<string, string> = { common: '#aeb6c2', uncommon: '#3cc6e6', rare: '#c768e8', legendary: '#e6b32e' };
const GLOW: Record<string, string> = { common: '#aac3e1', uncommon: '#46e1ff', rare: '#d66bff', legendary: '#ffcd50' };
const PATK: Record<string, number> = { common: 0.07, uncommon: 0.11, rare: 0.09, legendary: 0.09 };
const EDGE_W: Record<string, number> = { arcade: 0.62, flat: 0.5, premium: 0.26, classic: 0.5 };

type Rec = Record<string, unknown>;
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
const emptyTiers = () => ({ all: {}, common: {}, uncommon: {}, rare: {}, legendary: {} });

/** The built-in default (PRESET) in the saved shape {look, colors, opts, back}. */
export function defaultStyle(): CardStyle {
  const colors: CardStyle['colors'] = {};
  const opts: CardStyle['opts'] = {};
  for (const lk of ['arcade', 'flat', 'premium', 'classic']) {
    colors[lk] = { ...emptyTiers(), ...clone(PRESET.colors[lk] ?? {}) };
    opts[lk] = clone(PRESET.options[lk] ?? {});
  }
  return { look: PRESET.look, colors, opts, back: PRESET.back };
}

/** Saved style with every look present (older / partial saves are filled from the default). */
const complete = (s: CardStyle | null | undefined): CardStyle => {
  const d = defaultStyle();
  if (!s) return d;
  return { look: s.look || d.look, colors: { ...d.colors, ...clone(s.colors) }, opts: { ...d.opts, ...clone(s.opts) }, back: s.back || d.back }; // same key order as the draft, so the dirty check is stable
};

// ---------------------------------------------------------------- option controls (ported from the playground)
type Item = [string, string];
type Ctl =
  | { t: 'toggle'; key: string; label: string; defOn: boolean; labels?: [string, string]; when?: (o: Rec) => boolean; flat?: boolean }
  | { t: 'pick'; key: string; label: string; items: Item[]; def: string; when?: (o: Rec) => boolean; flat?: boolean }
  | { t: 'range'; key: string; label: string; min: number; max: number; div: number; def: number | ((look: string) => number); step?: number; zeroUnset?: boolean; when?: (o: Rec) => boolean; flat?: boolean }
  | { t: 'sep' };

const COST_ICONS: Item[] = [['none', 'None'], ['bolt', 'Bolt'], ['fire', 'Fire'], ['coin', 'Coins'], ['gem', 'Gem'], ['stars', 'Stars']];
const TITLE_FONTS = ['Bebas Neue', 'Anton', 'Oswald'];
const BODY_FONTS = ['Barlow Condensed', 'Roboto Condensed', 'Oswald'];
const cost = (o: Rec) => !!o.cost;
const kind = (o: Rec) => o.kindShow !== false;

const CONTROLS: Ctl[] = [
  { t: 'toggle', key: 'cost', label: 'Cost badge (energy mode)', defOn: false },
  { t: 'pick', key: 'costIcon', label: 'Cost icon', items: COST_ICONS, def: 'bolt', when: cost },
  { t: 'pick', key: 'costColor', label: 'Cost colour', items: [['rarity', 'Rarity'], ['neutral', 'Neutral']], def: 'rarity', when: cost },
  { t: 'pick', key: 'costShape', label: 'Cost shape', items: [['ring', 'Ring'], ['orb', '3D circle']], def: 'ring', when: cost },
  { t: 'range', key: 'costSize', label: 'Cost size', min: 60, max: 160, div: 100, def: 1, when: cost },
  { t: 'toggle', key: 'costHolo', label: 'Holo on cost', defOn: false, when: cost },
  { t: 'pick', key: 'costPos', label: 'Cost position', items: [['in-right', 'Inside right'], ['in-left', 'Inside left'], ['out-right', 'Corner right'], ['out-left', 'Corner left']], def: 'in-right', when: cost },
  { t: 'toggle', key: 'iconOverImage', label: 'Icon over image', defOn: false },
  { t: 'range', key: 'titleBar', label: 'Title bar strength', min: 0, max: 100, div: 100, def: 0, flat: true },
  { t: 'toggle', key: 'titleHolo', label: 'Holo on title bar', defOn: true, flat: true, when: (o) => o.titleBar != null || !!o.titleLine },
  { t: 'toggle', key: 'titleLine', label: 'Title bar outline', defOn: false, labels: ['Rarity', 'Off'], flat: true },
  { t: 'pick', key: 'artLine', label: 'Image outline', items: [['default', 'Look default'], ['off', 'Neutral'], ['thin', 'Rarity thin'], ['thick', 'Rarity thick']], def: 'default' },
  { t: 'sep' },
  { t: 'toggle', key: 'kindShow', label: 'Power type', defOn: true, labels: ['Show', 'Hide'] },
  { t: 'pick', key: 'kindShape', label: 'Type shape', items: [['default', 'Look default'], ['ribbon', 'Ribbon'], ['plate', 'Plate'], ['pill', 'Pill']], def: 'default', when: kind },
  { t: 'pick', key: 'kindColor', label: 'Type colour', items: [['default', 'Look default'], ['fill', 'Rarity fill'], ['outline', 'Rarity outline'], ['neutral', 'Neutral']], def: 'default', when: kind },
  { t: 'sep' },
  { t: 'pick', key: 'texture', label: 'Texture', items: [['none', 'None'], ['stone', 'Stone'], ['granite', 'Granite'], ['sandstone', 'Sandstone'], ['rock', 'Rough rock']], def: 'none' },
  { t: 'range', key: 'textureK', label: 'Texture strength', min: 0, max: 100, div: 100, def: 0.3, when: (o) => !!o.texture },
  { t: 'toggle', key: 'pattern', label: 'Scattered icons', defOn: true },
  { t: 'pick', key: 'patternIcon', label: 'Icon shape', items: [['card', 'Card icon'], ['dart', 'Dart'], ['dartboard', 'Dartboard'], ['bullseye', 'Bullseye'], ['mix', 'Mixed']], def: 'card', when: (o) => o.pattern !== false },
  { t: 'pick', key: 'patternColor', label: 'Icon colour', items: [['neutral', 'Neutral'], ['rarity', 'Rarity']], def: 'neutral', when: (o) => o.pattern !== false },
  { t: 'sep' },
  { t: 'toggle', key: 'showRarity', label: 'Rarity line', defOn: true, labels: ['Show', 'Hide'] },
  { t: 'toggle', key: 'showNumber', label: 'Card numbers', defOn: false },
  { t: 'pick', key: 'fontTitle', label: 'Title font', items: TITLE_FONTS.map((f) => [f, f]), def: TITLE_FONTS[0]! },
  { t: 'pick', key: 'fontBody', label: 'Body font', items: BODY_FONTS.map((f) => [f, f]), def: BODY_FONTS[0]! },
  { t: 'sep' },
  { t: 'range', key: 'edgeW', label: 'Card outline width', min: 0, max: 120, div: 100, def: (l) => EDGE_W[l] ?? 0.5 },
  { t: 'range', key: 'artDrop', label: 'Move image lower', min: 0, max: 40, div: 1, def: 0, zeroUnset: true },
  { t: 'range', key: 'artInset', label: 'Space beside image', min: 0, max: 80, div: 1, step: 2, def: 0, zeroUnset: true },
];

// ---------------------------------------------------------------- small pieces
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <span className="text-xs font-medium tracking-wide text-text-muted uppercase">{label}</span>
    {children}
  </div>
);

function Pick({ label, items, value, onChange }: { label: string; items: Item[]; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <SegmentedControl ariaLabel={label} value={value} options={items.map(([v, l]) => ({ value: v, label: l }))} onChange={onChange} />
    </Row>
  );
}

function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-border-subtle bg-transparent" />
    </label>
  );
}

function Range({ label, min, max, value, step = 1, onChange }: { label: string; min: number; max: number; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <Row label={label}>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent-gold)]" />
    </Row>
  );
}

// ---------------------------------------------------------------- measuring the art window (recommended picture size)
const SAMPLE = { name: 'Sample', rarity: 'uncommon', kind: 'GAMBLE', icon: 'dart', effect: 'x', when: 'x', limit: 'x' } as const;
function measureArt(look: string, opts: Rec): [number, number] {
  const el = renderCard({ ...SAMPLE }, { look, options: { ...opts, kindShow: true } });
  el.style.cssText += ';position:fixed;left:-9999px;top:0;--pc-w:750px';
  document.body.append(el);
  const a = el.querySelector('.pc2-art,.pcf-art,.pc-art')?.getBoundingClientRect();
  el.remove();
  return a ? [Math.round(a.width), Math.round(a.height)] : [676, 358];
}
const ratio = (w: number, h: number) => (w / h).toFixed(2) + ' : 1';

/** Recommended picture size for the current look + options (w x h on a 750 px wide card). Refreshes after fonts load. */
function useArtSize(look: string, opts: Rec): [number, number] {
  const [size, setSize] = useState<[number, number]>([676, 358]);
  const key = look + JSON.stringify(opts);
  useEffect(() => {
    let alive = true;
    void document.fonts.ready.then(() => alive && setSize(measureArt(look, opts)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return size;
}

function Preview({ style }: { style: CardStyle }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const samples: [string, RendererRarity][] = [['SHOT_CLOCK', 'common'], ['WEAK_HAND_1DART', 'uncommon'], ['PARITY_LOCK_FULL', 'rare'], ['DOUBLE_EDGED_SWORD', 'legendary']];
    host.replaceChildren(
      ...samples.map(([id, rar], i) => {
        const r = resolveStyle(style, rar);
        const el = renderCard(renderData(id as CardTypeId, rar.toUpperCase() as 'COMMON', undefined, 2), { index: i, total: 4, look: r.look, colors: r.colors, options: r.options });
        el.style.setProperty('--pc-w', '170px');
        return el;
      }),
    );
  }, [style]);
  return <div ref={ref} className="flex flex-wrap justify-center gap-3" />;
}

// ---------------------------------------------------------------- style editor
/** Card style: look, colours per rarity, all renderer options. Edited as a draft; "Save" sends it to every device. */
export function CardStyleForm({ saved, onSave }: { saved: CardStyle | null | undefined; onSave: (s: CardStyle | null) => Promise<unknown> | void }) {
  const [draft, setDraft] = useState<CardStyle>(() => complete(saved));
  const [scope, setScope] = useState('all');
  const [busy, setBusy] = useState(false);
  const base = JSON.stringify(complete(saved));
  const dirty = JSON.stringify(draft) !== base;
  const lastBase = useRef(base);
  useEffect(() => {
    // follow remote changes while nothing is pending
    setDraft((d) => (JSON.stringify(d) === lastBase.current ? complete(saved) : d));
    lastBase.current = base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const look = draft.look;
  const opts = (draft.opts[look] ?? {}) as Rec;
  const [artW, artH] = useArtSize(look, opts);
  const edit = (fn: (d: CardStyle) => void) =>
    setDraft((d) => {
      const n = clone(d);
      fn(n);
      return n;
    });
  const setOpt = (key: string, v: unknown) =>
    edit((n) => {
      const o = (n.opts[look] ||= {});
      if (v === undefined) delete o[key];
      else o[key] = v;
    });
  const tiers = (draft.colors[look] ?? emptyTiers()) as Record<string, Rec>;
  const r0 = scope === 'all' ? 'common' : scope;
  const cur: Rec = { body: BODY[look]?.[r0], accent: (look === 'flat' ? FLATEDGE : EDGE)[r0], glow: GLOW[r0], glowK: look === 'flat' && r0 !== 'uncommon' ? 0 : 1, ...(scope === 'all' ? tiers.all : { ...tiers.all, ...tiers[scope] }) };
  const setCol = (key: string, v: unknown) =>
    edit((n) => {
      const t = (n.colors[look] ||= emptyTiers());
      (t[scope] ||= {})[key] = v;
    });

  return (
    <div className="space-y-4">
      <Preview style={draft} />
      <Pick label="Look" items={LOOKS} value={look} onChange={(v) => { edit((n) => { n.look = v; }); setScope('all'); }} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border-subtle p-3">
          <Pick label="Colours for" items={Object.entries(TIER_LABEL)} value={scope} onChange={setScope} />
          <Colour label="Card colour" value={String(cur.body)} onChange={(v) => setCol('body', v)} />
          <Colour label="Edge colour" value={String(cur.accent)} onChange={(v) => setCol('accent', v)} />
          <Colour label="Glow colour" value={String(cur.glow)} onChange={(v) => setCol('glow', v)} />
          <Range label="Glow strength" min={0} max={150} value={Math.round(Number(cur.glowK) * 100)} onChange={(v) => setCol('glowK', v / 100)} />
          {opts.pattern !== false && (
            <>
              <Range label="Icon visibility" min={0} max={40} value={Math.round(Number(cur.patK ?? PATK[r0]) * 100)} onChange={(v) => setCol('patK', v / 100)} />
              <Range label="Icon glow" min={0} max={100} value={Math.round(Number(cur.patGlow ?? 0) * 100)} onChange={(v) => setCol('patGlow', v / 100)} />
            </>
          )}
          <Button size="sm" icon={RotateCcw} onClick={() => edit((n) => { n.colors[look] = { ...emptyTiers(), ...clone(PRESET.colors[look] ?? {}) }; })}>
            Reset colours of this look
          </Button>
          <Colour label="Card back colour" value={draft.back} onChange={(v) => edit((n) => { n.back = v; })} />
        </div>
        <div className="space-y-3 rounded-lg border border-border-subtle p-3">
          {CONTROLS.map((c, i) => {
            if (c.t === 'sep') return <hr key={i} className="border-border-subtle" />;
            if ((c.flat && look !== 'flat') || (c.when && !c.when(opts))) return null;
            const v = opts[c.key];
            if (c.t === 'toggle') {
              const on = v === undefined ? c.defOn : !!v;
              const [yes, no] = c.labels ?? ['On', 'Off'];
              return <Pick key={c.key} label={c.label} items={[['1', yes], ['0', no]]} value={on ? '1' : '0'} onChange={(x) => setOpt(c.key, (x === '1') === c.defOn ? undefined : x === '1')} />;
            }
            if (c.t === 'pick') return <Pick key={c.key} label={c.label} items={c.items} value={String(v ?? c.def)} onChange={(x) => setOpt(c.key, x === c.def ? undefined : x)} />;
            const def = typeof c.def === 'function' ? c.def(look) : c.def;
            const shown = Math.round(Number(v ?? def) * c.div);
            return (
              <div key={c.key}>
                <Range label={c.label} min={c.min} max={c.max} step={c.step} value={shown} onChange={(x) => setOpt(c.key, c.zeroUnset && !x ? undefined : x / c.div)} />
                {c.key === 'artInset' && (
                  <p className="mt-1 text-xs text-text-muted">
                    Picture now: ratio {ratio(artW, artH)}, recommended <b>{artW} x {artH} px</b> (2x: {artW * 2} x {artH * 2}). Sizes are for a 750 px wide (300 dpi print) card.
                  </p>
                )}
              </div>
            );
          })}
          {opts.pattern !== false && opts.patternIcon === 'mix' && (
            <Button size="sm" onClick={() => setOpt('patternSeed', Number(opts.patternSeed ?? 0) + 1)}>
              Reshuffle icons
            </Button>
          )}
          <Button size="sm" icon={RotateCcw} onClick={() => edit((n) => { n.opts[look] = clone(PRESET.options[look] ?? {}); })}>
            Reset options of this look
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="gold"
          icon={Save}
          disabled={!dirty}
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(draft);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save card style
        </Button>
        <Button
          icon={RotateCcw}
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(null);
              setDraft(defaultStyle());
            } finally {
              setBusy(false);
            }
          }}
        >
          Reset to default
        </Button>
        {dirty && <span className="text-sm text-accent-warning">Unsaved changes</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pictures per power
/** Optional picture per power (upload is downscaled in the browser, or paste a URL). Saved at once for every device. */
export function CardImagesForm({ settings, onChange }: { settings: CardSettings; onChange: (images: NonNullable<CardSettings['images']>) => Promise<unknown> | void }) {
  const images = settings.images ?? {};
  const resolved = resolveStyle(settings.style, 'common');
  const [w, h] = useArtSize(resolved.look, resolved.options);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const set = async (id: CardTypeId, url: string | null) => {
    const next = { ...images };
    if (url) next[id] = url;
    else delete next[id];
    setBusy(id);
    try {
      await onChange(next);
    } finally {
      setBusy(null);
    }
  };
  const upload = async (id: CardTypeId, file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      await set(id, await compressCardArt(file, [w, h]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  };

  return (
    <div className="space-y-3">
      <Notice tone="info">
        Recommended {w} x {h} px (ratio {ratio(w, h)}), shown cropped to fill. Keep the subject away from the bottom edge. Uploads are shrunk to that size (WebP, about 300 KB max).
      </Notice>
      {error && <Notice tone="danger">{error}</Notice>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {CARD_TYPES.map((c) => (
          <li key={c.id} className="flex gap-3 rounded-lg border border-border-subtle bg-bg-primary p-2">
            <PowerCard id={c.id} size="sm" settings={settings} />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-border-subtle px-3 text-sm hover:border-accent-gold">
                <Upload size={16} aria-hidden /> {busy === c.id ? 'Saving...' : 'Upload picture'}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void upload(c.id, e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <Field label="or paste URL">
                {(id) => (
                  <div className="flex gap-1">
                    <input
                      id={id}
                      type="url"
                      placeholder="https://..."
                      value={urls[c.id] ?? ''}
                      onChange={(e) => setUrls((u) => ({ ...u, [c.id]: e.target.value }))}
                      className="min-h-9 min-w-0 flex-1 rounded border border-border-subtle bg-bg-surface px-2 text-sm"
                    />
                    <Button size="sm" disabled={!/^https?:\/\//i.test(urls[c.id] ?? '')} onClick={() => void set(c.id, urls[c.id]!.trim()).then(() => setUrls((u) => ({ ...u, [c.id]: '' })))}>
                      Use
                    </Button>
                  </div>
                )}
              </Field>
              {images[c.id] && (
                <Button size="sm" variant="ghost" icon={ImageOff} onClick={() => void set(c.id, null)}>
                  Remove picture
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

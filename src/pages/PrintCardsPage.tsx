import { Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardIcon, RARITY_VAR } from '../components/cards/PowerCard.tsx';
import { RouteHeader } from '../components/RouteHeader.tsx';
import { Button, Notice, SegmentedControl } from '../components/ui.tsx';
import { CARD_BY_ID, CARD_TYPES, RARITY_LABEL, type CardTypeId } from '../engine/cardCatalog.ts';
import { cardConfig, printedCopies } from '../engine/cardConfig.ts';
import { DEFAULT_CARDS } from '../engine/defaults.ts';
import type { CardSettings } from '../engine/types.ts';
import { useLiveTournamentId } from '../hooks/ControlProvider.tsx';
import { TournamentScope, useTournamentState } from '../hooks/TransportProvider.tsx';
import { loadCustomAsset } from '../services/media/customAssets.ts';

/** Printable A4 deck (63 x 88 mm poker cards, 3 x 3 per sheet, with cut lines). */
export function PrintCardsPage() {
  const id = useLiveTournamentId();
  if (!id) return <PrintDeck settings={DEFAULT_CARDS} name={id === undefined ? '' : 'Default deck (no live tournament)'} />;
  return (
    <TournamentScope tournamentId={id}>
      <TournamentDeck />
    </TournamentScope>
  );
}

function TournamentDeck() {
  const state = useTournamentState();
  return <PrintDeck settings={state?.settings.cards ?? DEFAULT_CARDS} name={state?.meta?.name ?? ''} />;
}

function useCustomFaces(): Partial<Record<CardTypeId, string>> {
  const [faces, setFaces] = useState<Partial<Record<CardTypeId, string>>>({});
  useEffect(() => {
    let alive = true;
    void Promise.all(
      CARD_TYPES.map(async (c) => [c.id, (await loadCustomAsset(`${c.id}.png`)) ?? (await loadCustomAsset(`${c.id.toLowerCase()}.png`))] as const),
    ).then((list) => {
      if (!alive) return;
      setFaces(Object.fromEntries(list.filter(([, url]) => !!url)) as Partial<Record<CardTypeId, string>>);
    });
    return () => {
      alive = false;
    };
  }, []);
  return faces;
}

function PrintCard({ id, settings, face }: { id: CardTypeId; settings: CardSettings; face?: string }) {
  const card = CARD_BY_ID[id];
  const cfg = cardConfig(settings, id);
  const color = RARITY_VAR[cfg.rarity];
  return (
    <div className="print-card relative flex flex-col overflow-hidden bg-print-paper text-print-ink" style={{ width: '63mm', height: '88mm' }}>
      {face ? (
        <img src={face} alt={card.name} className="h-full w-full object-cover" />
      ) : (
        <div className="m-[3mm] flex flex-1 flex-col items-center gap-[2mm] rounded-[2mm] border-[1.2mm] p-[3mm] text-center" style={{ borderColor: color }}>
          <span className="text-[7pt] font-semibold tracking-widest uppercase" style={{ color }}>
            {RARITY_LABEL[cfg.rarity]} · {cfg.pool === 'LOSER' ? 'Loser' : 'Winner'} pool
          </span>
          <span style={{ color }} className="mt-[2mm]">
            <CardIcon id={id} size={64} />
          </span>
          <span className="font-display text-[15pt] leading-tight font-bold uppercase">{card.name}</span>
          <span className="text-[8.5pt] leading-snug">{card.rules}</span>
          <span className="mt-auto h-[3mm] w-full rounded-sm" style={{ background: color }} />
        </div>
      )}
    </div>
  );
}

function PrintDeck({ settings, name }: { settings: CardSettings; name: string }) {
  const [mode, setMode] = useState<'DECK' | 'ONE'>('DECK');
  const faces = useCustomFaces();
  const list = useMemo(() => {
    const out: CardTypeId[] = [];
    for (const c of CARD_TYPES) {
      const n = mode === 'ONE' ? (cardConfig(settings, c.id).enabled ? 1 : 0) : printedCopies(settings, c.id);
      for (let i = 0; i < n; i++) out.push(c.id);
    }
    return out;
  }, [settings, mode]);
  const sheets = Array.from({ length: Math.ceil(list.length / 9) }, (_, i) => list.slice(i * 9, i * 9 + 9));

  return (
    <div className="min-h-dvh bg-bg-primary print:bg-print-paper">
      <div className="print:hidden">
        <RouteHeader
          icon={Printer}
          title="Printable Deck"
          subtitle={name || 'A4 3x3 poker-size Power Cards'}
          actions={
            <Button variant="gold" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
          }
        />
        <div className="mx-auto max-w-4xl space-y-3 p-4">
          <SegmentedControl
            ariaLabel="Copies"
            value={mode}
            options={[
              { value: 'DECK', label: 'Full deck (copies from settings)' },
              { value: 'ONE', label: 'One of each card' },
            ]}
            onChange={setMode}
          />
          <Notice tone="info">
            {list.length} cards on {sheets.length} A4 sheet{sheets.length === 1 ? '' : 's'}. Print at 100% (no "fit to page"). Cut along the dashed lines. A Canva image named
            {' '}
            <code>CARD_ID.png</code> in <code>public/custom-cards/</code> replaces the built-in face ({Object.keys(faces).length} found).
          </Notice>
        </div>
      </div>
      <div className="flex flex-col items-center gap-6 pb-10 print:block print:gap-0 print:p-0">
        {sheets.map((sheet, i) => (
          <div key={i} className="print-sheet bg-print-paper p-[10mm] shadow-xl print:shadow-none" style={{ width: '210mm', minHeight: '297mm' }}>
            <div className="grid grid-cols-[repeat(3,63mm)] justify-center">
              {sheet.map((id, j) => (
                <div key={j} className="border border-dashed border-print-cut">
                  <PrintCard id={id} settings={settings} face={faces[id]} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

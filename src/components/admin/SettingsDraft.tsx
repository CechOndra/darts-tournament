import { AlertTriangle, Check, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Modal, Notice } from '../ui.tsx';

export interface Change {
  label: string;
  from: string;
  to: string;
}

const humanize = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return 'none';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (typeof v === 'string') return /^[A-Z0-9]{2,4}$/.test(v) ? v : humanize(v);
  return String(v);
};

/** Flat list of leaf differences between two JSON values, with readable labels. */
export function diffSettings(a: unknown, b: unknown, labels: Record<string, string> = {}, path: string[] = []): Change[] {
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a as object), ...Object.keys(b as object)])];
    return keys.flatMap((k) => diffSettings((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], labels, [...path, k]));
  }
  if (a === b) return [];
  const key = path.join('.');
  const label = labels[key] ?? path.map((p) => labels[p] ?? humanize(p)).join(' > ');
  return [{ label, from: show(a), to: show(b) }];
}

/**
 * Edit settings as a draft; nothing changes for other devices until the admin reviews the
 * list of changes and confirms (with a warning when a match is live).
 */
export function SettingsDraft<T>({
  value,
  onApply,
  labels,
  liveWarning,
  children,
}: {
  value: T;
  onApply: (draft: T) => Promise<unknown> | void;
  labels?: Record<string, string>;
  /** Shown in the confirmation when a match is on the oche (null = nothing live). */
  liveWarning?: string | null;
  children: (draft: T, setDraft: (next: T) => void) => ReactNode;
}) {
  const [draft, setDraft] = useState<T>(value);
  const [dirty, setDirty] = useState(false);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);

  // Follow remote changes while the admin has nothing pending.
  useEffect(() => {
    if (!dirty) setDraft(value);
  }, [value, dirty]);

  const changes = useMemo(() => diffSettings(value, draft, labels), [value, draft, labels]);
  const pending = dirty && changes.length > 0;

  return (
    <div className="space-y-4">
      {children(draft, (next) => {
        setDraft(next);
        setDirty(true);
      })}
      {pending && (
        <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent-gold bg-bg-elevated p-3 shadow-2xl lg:bottom-4">
          <p className="text-sm font-medium">
            {changes.length} unsaved change{changes.length === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              icon={Undo2}
              onClick={() => {
                setDraft(value);
                setDirty(false);
              }}
            >
              Discard
            </Button>
            <Button size="sm" variant="gold" icon={Check} onClick={() => setReview(true)}>
              Review & apply
            </Button>
          </div>
        </div>
      )}
      {review && (
        <Modal
          title="Apply these changes?"
          onClose={() => setReview(false)}
          footer={
            <>
              <Button onClick={() => setReview(false)}>Keep editing</Button>
              <Button
                variant={liveWarning ? 'danger' : 'primary'}
                icon={liveWarning ? AlertTriangle : Check}
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onApply(draft);
                    setDirty(false);
                    setReview(false);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {liveWarning ? 'Apply during live match' : 'Apply changes'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {liveWarning && <Notice tone="danger">{liveWarning}</Notice>}
            <ul className="space-y-1">
              {changes.map((c, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-bg-primary px-3 py-1.5">
                  <span className="text-text-muted">{c.label}</span>
                  <span className="font-mono text-xs">
                    {c.from} <span className="text-text-muted">to</span> <span className="font-semibold text-accent-gold">{c.to}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted">Every connected device updates as soon as you apply.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

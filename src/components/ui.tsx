import { ChevronDown, X, type LucideIcon } from 'lucide-react';
import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent-primary text-text-primary hover:bg-accent-primary-hover border-transparent',
  secondary: 'bg-bg-elevated text-text-primary border-border-subtle hover:border-border-strong',
  danger: 'bg-accent-danger text-text-primary border-transparent hover:brightness-110',
  ghost: 'bg-transparent text-text-muted border-transparent hover:text-text-primary hover:bg-bg-elevated',
  gold: 'bg-accent-gold text-text-inverse border-transparent hover:brightness-110',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  busy?: boolean;
}

export function Button({ variant = 'secondary', icon: Icon, size = 'md', busy, className = '', children, disabled, ...rest }: ButtonProps) {
  const sizing = size === 'sm' ? 'min-h-9 px-3 text-sm' : size === 'lg' ? 'min-h-14 px-5 text-lg' : 'min-h-11 px-4 text-sm';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${VARIANT[variant]} ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {Icon && <Icon size={size === 'lg' ? 22 : 16} aria-hidden className={busy ? 'animate-pulse' : ''} />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Form fields
interface FieldProps {
  label: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}

export function Field({ label, hint, children, className = '' }: FieldProps) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium tracking-wide text-text-muted uppercase">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

const inputBase =
  'w-full min-h-11 rounded-md border bg-bg-primary px-3 text-base text-text-primary outline-none transition focus:border-accent-gold';

export function TextInput({ amber, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { amber?: boolean }) {
  return (
    <input
      className={`${inputBase} ${amber ? 'border-accent-warning/70 bg-accent-warning/5' : 'border-border-subtle'} ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputBase} border-border-subtle ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-text-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full border border-border-strong bg-bg-primary transition peer-checked:border-accent-success peer-checked:bg-accent-success/30 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-gold" />
        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-text-muted transition peer-checked:translate-x-5 peer-checked:bg-accent-success" />
      </span>
    </label>
  );
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1 rounded-md border border-border-subtle bg-bg-primary p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 flex-1 rounded px-3 text-sm font-medium transition ${
            o.value === value ? 'bg-accent-gold text-text-inverse' : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Layout
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Card on desktop (>= 1024px); collapsible accordion on phones. */
export function Section({
  id,
  title,
  icon: Icon,
  badge,
  open,
  onToggle,
  children,
  className = '',
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const expanded = desktop || open;
  return (
    <section id={id} className={`surface scroll-mt-20 ${className}`}>
      <h2>
        <button
          type="button"
          onClick={desktop ? undefined : onToggle}
          aria-expanded={expanded}
          className={`flex w-full items-center gap-2 px-4 py-3 text-left ${desktop ? 'cursor-default' : ''}`}
        >
          <Icon size={18} className="text-accent-gold" aria-hidden />
          <span className="flex-1 font-display text-sm tracking-widest uppercase">{title}</span>
          {badge}
          {!desktop && <ChevronDown size={18} className={`transition ${open ? 'rotate-180' : ''}`} aria-hidden />}
        </button>
      </h2>
      {expanded && <div className="border-t border-border-subtle p-4">{children}</div>}
    </section>
  );
}

export function Badge({ tone = 'muted', children }: { tone?: 'muted' | 'gold' | 'success' | 'danger' | 'warning'; children: ReactNode }) {
  const tones = {
    muted: 'border-border-subtle text-text-muted',
    gold: 'border-accent-gold/50 text-accent-gold',
    success: 'border-accent-success/50 text-accent-success',
    danger: 'border-accent-danger/60 bg-accent-danger/15 text-accent-danger',
    warning: 'border-accent-warning/60 text-accent-warning',
  };
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Notice({ tone = 'warning', children }: { tone?: 'warning' | 'danger' | 'info' | 'success'; children: ReactNode }) {
  const tones = {
    warning: 'border-accent-warning/40 bg-accent-warning/10 text-accent-warning',
    danger: 'border-accent-danger/50 bg-accent-danger/10 text-accent-danger',
    info: 'border-accent-info/40 bg-accent-info/10 text-accent-info',
    success: 'border-accent-success/40 bg-accent-success/10 text-accent-success',
  };
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}

// ---------------------------------------------------------------- Modal
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg-overlay p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="surface-elevated w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="font-display text-base tracking-wide uppercase">{title}</h2>
          <button type="button" onClick={onClose} className="touch-target flex items-center justify-center text-text-muted hover:text-text-primary" aria-label="Close">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto p-4 text-sm">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Avatar
export function Avatar({ name, src, size = 40 }: { name: string; src: string | null; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';
  return src ? (
    <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full border border-border-subtle object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-label={name}
      className="flex shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated font-display font-semibold text-accent-gold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

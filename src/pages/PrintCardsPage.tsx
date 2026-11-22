import { Printer } from 'lucide-react';
import { Placeholder, RouteHeader } from '../components/RouteHeader.tsx';

export function PrintCardsPage() {
  return (
    <div className="min-h-dvh bg-bg-primary">
      <RouteHeader icon={Printer} title="Printable Deck" subtitle="A4 3x3 poker-size Power Cards" />
      <main className="mx-auto max-w-4xl p-4">
        <Placeholder milestone={5}>The printable A4 Power Card deck with cut lines arrives in Milestone 5.</Placeholder>
      </main>
    </div>
  );
}

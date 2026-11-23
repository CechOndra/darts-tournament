import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NoTournament } from './components/NoTournament.tsx';
import { UpdateBanner } from './components/UpdateBanner.tsx';
import { ControlProvider } from './hooks/ControlProvider.tsx';

// Each route is its own chunk: guests on phones only download the guest page.
const GuestPage = lazy(() => import('./pages/GuestPage.tsx').then((m) => ({ default: m.GuestPage })));
const ScorerPage = lazy(() => import('./pages/ScorerPage.tsx').then((m) => ({ default: m.ScorerPage })));
const StagePage = lazy(() => import('./pages/StagePage.tsx').then((m) => ({ default: m.StagePage })));
const AdminPage = lazy(() => import('./pages/AdminPage.tsx').then((m) => ({ default: m.AdminPage })));
const PrintCardsPage = lazy(() => import('./pages/PrintCardsPage.tsx').then((m) => ({ default: m.PrintCardsPage })));
const BoardMapPage = lazy(() => import('./pages/BoardMapPage.tsx').then((m) => ({ default: m.BoardMapPage })));

export function App() {
  return (
    <HashRouter>
      <ControlProvider>
        <UpdateBanner />
        <Suspense fallback={<NoTournament loading />}>
          <Routes>
            <Route path="/" element={<GuestPage />} />
            <Route path="/scorer" element={<ScorerPage />} />
            <Route path="/stage" element={<StagePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/print-cards" element={<PrintCardsPage />} />
            <Route path="/board-map" element={<BoardMapPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ControlProvider>
    </HashRouter>
  );
}

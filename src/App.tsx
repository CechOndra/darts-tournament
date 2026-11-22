import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ControlProvider } from './hooks/ControlProvider.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { BoardMapPage } from './pages/BoardMapPage.tsx';
import { GuestPage } from './pages/GuestPage.tsx';
import { PrintCardsPage } from './pages/PrintCardsPage.tsx';
import { ScorerPage } from './pages/ScorerPage.tsx';
import { StagePage } from './pages/StagePage.tsx';

export function App() {
  return (
    <HashRouter>
      <ControlProvider>
        <Routes>
          <Route path="/" element={<GuestPage />} />
          <Route path="/scorer" element={<ScorerPage />} />
          <Route path="/stage" element={<StagePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/print-cards" element={<PrintCardsPage />} />
          <Route path="/board-map" element={<BoardMapPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ControlProvider>
    </HashRouter>
  );
}

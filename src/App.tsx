import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LangProvider, useI18n } from './lib/i18n';
import { useStands } from './state/StandsProvider';
import { AuthProvider } from './state/AuthProvider';
import { StandsProvider } from './state/StandsProvider';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ProfileGateModal } from './components/ProfileGateModal';
import { ShareSheet } from './components/ShareSheet';
import Home from './pages/Home';
import Stands from './pages/Stands';
import StandDetail from './pages/StandDetail';
import Me from './pages/Me';
import About from './pages/About';
import DataRights from './pages/DataRights';
import Verify from './pages/Verify';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function JoinErrorToast() {
  const { joinError, clearJoinError } = useStands();
  const { t } = useI18n();
  if (!joinError) return null;
  const msg =
    joinError === 'locked'
      ? t('join.locked')
      : joinError === 'not-ready'
        ? t('join.notReady')
        : joinError === 'no-key'
          ? t('join.noKey')
          : t('misc.error');
  return (
    <div
      role="alert"
      className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md card p-4 flex items-start gap-3 text-sm shadow-lift"
    >
      <span className="flex-1">{msg}</span>
      <button className="text-sub hover:text-navy font-semibold" onClick={clearJoinError} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <StandsProvider>
          <ScrollToTop />
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 pb-8">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/stands" element={<Stands />} />
                <Route path="/stand/:id" element={<StandDetail />} />
                <Route path="/me" element={<Me />} />
                <Route path="/about" element={<About />} />
                <Route path="/data-rights" element={<DataRights />} />
                <Route path="/verify" element={<Verify />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
          <ProfileGateModal />
          <ShareSheet />
          <JoinErrorToast />
        </StandsProvider>
      </AuthProvider>
    </LangProvider>
  );
}

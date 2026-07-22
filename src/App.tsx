import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LangProvider, useI18n } from './lib/i18n';
import { useStands } from './state/StandsProvider';
import { AuthProvider } from './state/AuthProvider';
import { StandsProvider } from './state/StandsProvider';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProfileGateModal } from './components/ProfileGateModal';
import { ShareSheet } from './components/ShareSheet';
import Home from './pages/Home';
import Stands from './pages/Stands';
import StandDetail from './pages/StandDetail';
import Me from './pages/Me';
import About from './pages/About';
import DataRights from './pages/DataRights';
import Verify from './pages/Verify';
import Feed from './pages/Feed';
import AddToFeed from './pages/AddToFeed';
import Moderation from './pages/Moderation';
import Admin from './pages/Admin';
import EvidencePlayer from './pages/EvidencePlayer';
import { configError } from './lib/supabase';

/** Deployed with no backend config: a clear failure, never silent demo data. */
function ConfigErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-md p-8 text-center space-y-4">
        <h1 className="font-display font-bold text-2xl text-navy">Configuration error</h1>
        <p className="text-sm text-sub leading-relaxed">
          This deployment has no database configured, so no real counts can be shown.
          Demo data is never served on a public host. Operator: set the four{' '}
          <code className="font-mono">VITE_*</code> build variables (see docs/DEPLOY.md) and redeploy.
        </p>
        <p className="text-sm text-sub leading-relaxed">
          इस डिप्लॉयमेंट में डेटाबेस कॉन्फ़िगर नहीं है, इसलिए वास्तविक गिनती नहीं दिखाई जा सकती।
        </p>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function JoinErrorToast() {
  const { joinError, clearJoinError } = useStands();
  const { t } = useI18n();
  if (!joinError) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md card p-4 flex items-start gap-3 text-sm shadow-lift"
    >
      <span className="flex-1">{t('misc.error')}</span>
      <button className="text-sub hover:text-navy font-semibold" onClick={clearJoinError} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

/** Space reserved for mobile BottomNav so Watch reels never cover it. */
const NAV_PAD = 'pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-8';

function Shell() {
  const { pathname } = useLocation();
  // Watch is reels-style: hide chrome header/footer, keep BottomNav always.
  const watch = pathname.startsWith('/evidence');

  return (
    <div className="min-h-screen flex flex-col">
      {!watch && <Header />}
      <main className={`flex-1 ${watch ? `min-h-0 ${NAV_PAD}` : NAV_PAD}`}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stands" element={<Stands />} />
            <Route path="/stand/:id" element={<StandDetail />} />
            <Route path="/me" element={<Me />} />
            <Route path="/about" element={<About />} />
            <Route path="/data-rights" element={<DataRights />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/add" element={<AddToFeed />} />
            <Route path="/evidence" element={<EvidencePlayer />} />
            <Route path="/moderation" element={<Moderation />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      {!watch && <Footer />}
      <BottomNav />
    </div>
  );
}

export default function App() {
  if (configError) return <ConfigErrorScreen />;
  return (
    <LangProvider>
      <AuthProvider>
        <StandsProvider>
          <ScrollToTop />
          <Shell />
          <ProfileGateModal />
          <ShareSheet />
          <JoinErrorToast />
        </StandsProvider>
      </AuthProvider>
    </LangProvider>
  );
}

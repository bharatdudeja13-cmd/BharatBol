import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LangProvider, useI18n } from './lib/i18n';
import { useStands } from './state/StandsProvider';
import { AuthProvider } from './state/AuthProvider';
import { StandsProvider } from './state/StandsProvider';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
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
    // Block body on purpose: scrollTo returns a Promise in newer Chrome,
    // and a concise arrow would hand that Promise to React as a cleanup
    // function — crashing (blank page) on the first client-side navigation.
    window.scrollTo(0, 0);
  }, [pathname]);
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
  if (configError) return <ConfigErrorScreen />;
  return (
    <LangProvider>
      <AuthProvider>
        <StandsProvider>
          <ScrollToTop />
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 pb-8">
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
                <Route path="/moderation" element={<Moderation />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </ErrorBoundary>
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

import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LangProvider } from './lib/i18n';
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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
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
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
          <ProfileGateModal />
          <ShareSheet />
        </StandsProvider>
      </AuthProvider>
    </LangProvider>
  );
}

import { Link, NavLink } from 'react-router-dom';
import { BrandMark } from './AshokaChakra';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../state/AuthProvider';
import { isLive } from '../lib/supabase';
import { BRAND } from '../config/brand';
import { LanguageSelector } from './LanguageSelector';

export function Header() {
  const { t, lang } = useI18n();
  const { session, signIn, signOut } = useAuth();

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `btn-ghost text-sm ${isActive ? 'text-navy underline underline-offset-8 decoration-saffron decoration-2' : 'text-sub'}`;

  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2.5 mr-auto" aria-label="BharatBol home">
          <BrandMark size={36} />
          <span className="font-display text-xl tracking-tight">
            {lang === 'hi' ? (
              <>
                {BRAND.wordmarkHi.regular} <b className="font-bold">{BRAND.wordmarkHi.bold}</b>
              </>
            ) : (
              <>
                {BRAND.wordmark.regular}
                <b className="font-bold">{BRAND.wordmark.bold}</b>
              </>
            )}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          <NavLink to="/stands" className={navCls}>
            {t('nav.stands')}
          </NavLink>
          <NavLink to="/feed" className={navCls}>
            {t('nav.feed')}
          </NavLink>
          <NavLink to="/about" className={navCls}>
            {t('nav.about')}
          </NavLink>
          {session && (
            <NavLink to="/me" className={navCls}>
              {t('nav.profile')}
            </NavLink>
          )}
        </nav>

        <LanguageSelector />

        {isLive &&
          (session ? (
            <button className="btn-ghost text-sm text-sub" onClick={() => void signOut()}>
              {t('nav.signOut')}
            </button>
          ) : (
            <button className="btn-secondary text-sm !min-h-[40px] !px-4 !py-1.5" onClick={() => void signIn()}>
              {t('nav.signIn')}
            </button>
          ))}
      </div>
    </header>
  );
}

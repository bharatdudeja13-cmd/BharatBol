import { NavLink } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../state/AuthProvider';

/** Mobile-first bottom navigation. Hidden on md+ where Header links suffice. */
export function BottomNav() {
  const { t } = useI18n();
  const { session } = useAuth();

  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center gap-0.5 min-h-[52px] flex-1 text-[10px] font-semibold tracking-wide ${
      isActive ? 'text-navy' : 'text-sub'
    }`;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[60] border-t border-line bg-bg/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        <NavLink to="/" end className={cls}>
          <span aria-hidden className="text-base">⌂</span>
          {t('nav.home')}
        </NavLink>
        <NavLink to="/stands" className={cls}>
          <span aria-hidden className="text-base">◎</span>
          {t('nav.stands')}
        </NavLink>
        <NavLink to="/feed" className={cls}>
          <span aria-hidden className="text-base">▷</span>
          {t('nav.feed')}
        </NavLink>
        <NavLink to="/add" className={cls}>
          <span aria-hidden className="text-base">＋</span>
          {t('nav.addShort')}
        </NavLink>
        <NavLink to={session ? '/me' : '/about'} className={cls}>
          <span aria-hidden className="text-base">{session ? '◉' : '?'}</span>
          {session ? t('nav.profile') : t('nav.about')}
        </NavLink>
      </div>
    </nav>
  );
}

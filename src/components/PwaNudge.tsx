import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useStands } from '../state/StandsProvider';

const VISIT_KEY = 'bharatbol:visits';
const DISMISS_KEY = 'bharatbol:pwa-dismiss';

/** One-time install nudge after third visit or first stand. */
export function PwaNudge() {
  const { t } = useI18n();
  const { joined } = useStands();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    if (standalone) return;

    const visits = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    if (visits >= 3 || joined.size > 0) setShow(true);
  }, [joined.size]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      className="md:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] inset-x-3 z-30 card p-4 shadow-lift space-y-2"
    >
      <p className="font-display font-semibold text-navy">{t('pwa.nudgeTitle')}</p>
      <p className="text-sm text-sub">{t('pwa.nudgeBody')}</p>
      <div className="flex gap-2 pt-1">
        <Link to="/add" className="btn-primary text-sm !py-2 flex-1 text-center" onClick={() => setShow(false)}>
          {t('pwa.nudgeCta')}
        </Link>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setShow(false);
          }}
        >
          {t('pwa.nudgeDismiss')}
        </button>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { AshokaChakra } from './AshokaChakra';
import { useI18n } from '../lib/i18n';
import { REPO_URL, isLive } from '../lib/supabase';

/** India national emergency & helpline numbers (india.gov.in directory). Short list only. */
const HELPLINES = [
  { tel: '112', labelKey: 'footer.helpline.emergency' as const },
  { tel: '100', labelKey: 'footer.helpline.police' as const },
  { tel: '101', labelKey: 'footer.helpline.fire' as const },
  { tel: '102', labelKey: 'footer.helpline.ambulance' as const },
  { tel: '108', labelKey: 'footer.helpline.medical' as const },
  { tel: '1091', labelKey: 'footer.helpline.women' as const },
  { tel: '1098', labelKey: 'footer.helpline.child' as const },
] as const;

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-line bg-faint pb-28 md:pb-10">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <section aria-labelledby="footer-helplines-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2
              id="footer-helplines-heading"
              className="text-xs font-semibold uppercase tracking-wide text-navy"
            >
              {t('footer.helplines')}
            </h2>
            <p className="text-[11px] text-sub">{t('footer.helpline.hint')}</p>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {HELPLINES.map(({ tel, labelKey }) => (
              <li key={tel}>
                <a
                  href={`tel:${tel}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5 min-h-[44px] text-sm hover:border-saffron/50 hover:bg-white active:bg-faint transition"
                >
                  <span className="text-sub leading-tight">{t(labelKey)}</span>
                  <span className="font-mono font-bold text-navy tabular-nums shrink-0">{tel}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex items-start gap-3 text-sub text-sm leading-relaxed">
          <span className="mt-0.5 text-navy shrink-0">
            <AshokaChakra size={18} />
          </span>
          <p>
            {t('disclaimer')}{' '}
            <Link to="/about" className="font-semibold text-navy hover:underline underline-offset-4">
              {t('cis.footerLine')}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-navy">
          <Link to="/about" className="hover:underline underline-offset-4">
            {t('footer.about')}
          </Link>
          <Link to="/data-rights" className="hover:underline underline-offset-4">
            {t('footer.data')}
          </Link>
          <Link to="/privacy" className="hover:underline underline-offset-4">
            Privacy policy
          </Link>
          <Link to="/ledger" className="hover:underline underline-offset-4">
            {t('plog.title')}
          </Link>
          <Link to="/moderation" className="hover:underline underline-offset-4">
            {t('policy.title')}
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
            {t('footer.source')}
          </a>
        </div>
        <div className="flex items-center gap-2 text-xs text-sub font-mono">
          <span className="inline-block w-6 h-1 rounded bg-saffron" aria-hidden="true" />
          <span className="inline-block w-6 h-1 rounded bg-white border border-line" aria-hidden="true" />
          <span className="inline-block w-6 h-1 rounded bg-green" aria-hidden="true" />
          <span className="ml-2">bharatbol · {t('app.tagline')}</span>
        </div>
        {!isLive && (
          <p className="text-xs text-saffron font-medium">{t('demo.banner')}</p>
        )}
      </div>
    </footer>
  );
}

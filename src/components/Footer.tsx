import { Link } from 'react-router-dom';
import { AshokaChakra } from './AshokaChakra';
import { useI18n } from '../lib/i18n';
import { REPO_URL, isLive } from '../lib/supabase';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-line bg-faint">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <div className="flex items-start gap-3 text-sub text-sm leading-relaxed">
          <span className="mt-0.5 text-navy shrink-0">
            <AshokaChakra size={18} />
          </span>
          <p>{t('disclaimer')}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-navy">
          <Link to="/about" className="hover:underline underline-offset-4">
            {t('footer.about')}
          </Link>
          <Link to="/data-rights" className="hover:underline underline-offset-4">
            {t('footer.data')}
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
            {t('footer.source')}
          </a>
        </div>
        <div className="flex items-center gap-2 text-xs text-sub font-mono">
          <span className="inline-block w-6 h-1 rounded bg-saffron" aria-hidden="true" />
          <span className="inline-block w-6 h-1 rounded bg-white border border-line" aria-hidden="true" />
          <span className="inline-block w-6 h-1 rounded bg-green" aria-hidden="true" />
          <span className="ml-2">praja · {t('app.tagline')}</span>
        </div>
        {!isLive && (
          <p className="text-xs text-saffron font-medium">{t('demo.banner')}</p>
        )}
      </div>
    </footer>
  );
}

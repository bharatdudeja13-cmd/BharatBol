import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../state/AuthProvider';
import { isLive } from '../lib/supabase';

export default function DataRights() {
  const { t } = useI18n();
  const { session } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-10 leading-relaxed">
      <header>
        <h1 className="font-display font-bold text-3xl text-navy">{t('dataRights.title')}</h1>
        <p className="mt-2 text-sub">{t('dataRights.lead')}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('dataRights.storeTitle')}</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-sub border-b border-line">
                <th className="p-3 font-semibold">{t('dataRights.colData')}</th>
                <th className="p-3 font-semibold">{t('dataRights.colWhy')}</th>
                <th className="p-3 font-semibold">{t('dataRights.colPublic')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="p-3">{t('dataRights.rowGoogle')}</td>
                <td className="p-3 text-sub">{t('dataRights.whyGoogle')}</td>
                <td className="p-3 font-semibold text-green">{t('dataRights.never')}</td>
              </tr>
              <tr>
                <td className="p-3">{t('dataRights.rowName')}</td>
                <td className="p-3 text-sub">{t('dataRights.whyName')}</td>
                <td className="p-3 text-sub">{t('dataRights.optIn')}</td>
              </tr>
              <tr>
                <td className="p-3">{t('dataRights.rowState')}</td>
                <td className="p-3 text-sub">{t('dataRights.whyState')}</td>
                <td className="p-3 text-sub">{t('dataRights.agg')}</td>
              </tr>
              <tr>
                <td className="p-3">{t('dataRights.rowStands')}</td>
                <td className="p-3 text-sub">{t('dataRights.whyStands')}</td>
                <td className="p-3 text-sub">{t('dataRights.countsOnly')}</td>
              </tr>
              <tr>
                <td className="p-3">{t('dataRights.rowReact')}</td>
                <td className="p-3 text-sub">{t('dataRights.whyReact')}</td>
                <td className="p-3 text-sub">{t('dataRights.countsOnly')}</td>
              </tr>
              <tr>
                <td className="p-3">{t('dataRights.rowSubmit')}</td>
                <td className="p-3 text-sub">{t('dataRights.whySubmit')}</td>
                <td className="p-3 font-semibold text-green">{t('dataRights.never')}</td>
              </tr>
              <tr>
                <td className="p-3">{t('dataRights.rowWall')}</td>
                <td className="p-3 text-sub">{t('dataRights.whyWall')}</td>
                <td className="p-3 text-sub">{t('dataRights.wallPublic')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sub text-sm">{t('dataRights.complete')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('dataRights.rightsTitle')}</h2>
        <ul className="list-disc pl-5 text-sub space-y-2">
          <li>
            <strong className="text-ink">{t('dataRights.rightSee')}</strong> {t('dataRights.rightSeeBody')}
          </li>
          <li>
            <strong className="text-ink">{t('dataRights.rightOpt')}</strong> {t('dataRights.rightOptBody')}
          </li>
          <li>
            <strong className="text-ink">{t('dataRights.rightWithdraw')}</strong>{' '}
            {t('dataRights.rightWithdrawBody')}
          </li>
          <li>
            <strong className="text-ink">{t('dataRights.rightErase')}</strong> {t('dataRights.rightEraseBody')}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('dataRights.doNow')}</h2>
        {isLive && session ? (
          <Link to="/me" className="btn-primary">
            {t('profile.title')} →
          </Link>
        ) : (
          <p className="text-sub text-sm">
            {t('profile.signInFirst')}{' '}
            <Link to="/me" className="text-navy underline underline-offset-4">
              {t('nav.profile')}
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

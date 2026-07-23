import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { REPO_URL } from '../lib/supabase';
import { AshokaChakra } from '../components/AshokaChakra';

export default function About() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-10 leading-relaxed">
      <header>
        <p className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-sub">
          <AshokaChakra size={16} /> {t('app.kicker')}
        </p>
        <h1 className="mt-3 font-display font-bold text-3xl text-navy">{t('about.title')}</h1>
      </header>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('about.missionTitle')}</h2>
        <p className="text-sub">{t('about.mission1')}</p>
        <p className="text-sub">{t('about.mission2')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('about.feedTitle')}</h2>
        <p className="text-sub">{t('about.feedBody')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('about.evidenceTitle')}</h2>
        <p className="text-sub">{t('about.evidenceBody')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('about.countsTitle')}</h2>
        <p className="text-sub">{t('about.counts1')}</p>
        <p className="text-sub">{t('about.counts2')}</p>
      </section>

      <section className="card p-6 space-y-3 border-navy/20">
        <h2 className="font-display font-semibold text-xl">{t('cis.title')}</h2>
        <p className="text-sub">
          <strong className="text-ink">{t('cis.money')}</strong>
        </p>
        <p className="text-sub">{t('cis.entity')}</p>
        <p className="text-sub">{t('cis.instruct')}</p>
        <p className="text-sub italic">{t('cis.future')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('about.rulesTitle')}</h2>
        <ul className="list-disc pl-5 text-sub space-y-2">
          <li>{t('about.rule1')}</li>
          <li>{t('about.rule2')}</li>
          <li>{t('about.rule3')}</li>
          <li>{t('about.rule4')}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('about.privacyTitle')}</h2>
        <p className="text-sub">{t('about.privacy1')}</p>
        <p className="text-sub">{t('about.privacy2')}</p>
        <p className="text-sub">
          <Link to="/data-rights" className="text-navy underline underline-offset-4">
            {t('footer.data')}
          </Link>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('verify.title')}</h2>
        <p className="text-sub">
          {t('about.verifyBlurb')}{' '}
          <Link to="/verify" className="text-navy underline underline-offset-4">
            {t('verify.title')} →
          </Link>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('about.openSource')}</h2>
        <p className="text-sub">
          {t('about.openSourceBody')}{' '}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-navy underline underline-offset-4 break-all"
          >
            {REPO_URL}
          </a>
        </p>
      </section>

      <section className="card p-5 text-sm text-sub">{t('disclaimer')}</section>
    </div>
  );
}

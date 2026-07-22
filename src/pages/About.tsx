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
        <h1 className="mt-3 font-display font-bold text-3xl text-navy">About BharatBol</h1>
      </header>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">The mission</h2>
        <p className="text-sub">
          BharatBol (भारत बोल — “Bharat, speak”) is a national civic square. It exists so that any Indian
          citizen — whatever party they support, or none — can publicly stand on an issue and be
          counted, verifiably and in the open. It belongs to no movement and no party. It is a call
          to the whole country.
        </p>
        <p className="text-sub">
          BharatBol’s public promise on the surface: <strong className="text-ink">prove how many</strong>{' '}
          — counts of verified engaged citizens — and <strong className="text-ink">never show who</strong>{' '}
          on the public walls and maps (supporter names appear only if you opt in).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Why citizen evidence</h2>
        <p className="text-sub">
          National media houses cannot be treated as a reliable sole source for what citizens are
          seeing on the ground — incentives, access, and framing differ from lived civic reality.
          BharatBol therefore hosts a feed of <strong className="text-ink">citizen-submitted
          evidence</strong> (public links only, never re-hosted), sorted by issue and state, each
          labelled <em>unverified</em>, so anyone can watch what people are sharing and then stand
          on the issue. It is not a court of truth and not a substitute for journalism; it is a
          shared window onto citizen-sourced clips.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">What the counts mean — honestly</h2>
        <p className="text-sub">
          Every number on BharatBol counts <strong className="text-ink">verified engaged citizens</strong>:
          people who signed in with a Google account and chose to stand. One account can stand once
          per issue — the database itself enforces this. A stand can be withdrawn at any time, and
          the count decreases accordingly.
        </p>
        <p className="text-sub">
          These counts are <em>not</em> a census, a survey, or an election. People who stand here
          chose to show up — they are not a statistical sample of India. The numbers show how many
          people cared enough to be counted, nothing more and nothing less. We believe that is
          already worth knowing.
        </p>
      </section>

      <section className="card p-6 space-y-3 border-navy/20">
        <h2 className="font-display font-semibold text-xl">{t('cis.title')}</h2>
        <p className="text-sub"><strong className="text-ink">{t('cis.money')}</strong></p>
        <p className="text-sub">{t('cis.entity')}</p>
        <p className="text-sub">{t('cis.instruct')}</p>
        <p className="text-sub italic">{t('cis.future')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Rules of the square</h2>
        <ul className="list-disc pl-5 text-sub space-y-2">
          <li>Every stand is about an <strong className="text-ink">issue</strong> — never about a person, party, company, or community.</li>
          <li>BharatBol never favours or attacks any party. It is the neutral layer above all of them.</li>
          <li>BharatBol measures sentiment. It never instructs anyone to take any action.</li>
          <li>Standing is free, requires no fee ever, and is revocable by you alone.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Privacy — the honest version</h2>
        <p className="text-sub">
          <strong className="text-ink">Temporary mode (now):</strong> stands and evidence reactions
          are tied to your Google login so you can stand, withdraw, and react from any device without
          browser receipts. The database therefore <em>can</em> link your account to which issues
          you stood on and which clips you marked useful — operators with database access can see
          that link. The public site still does not publish your name next to a stand unless you opt
          into the supporter wall.
        </p>
        <p className="text-sub">
          Cryptographic unlinkability (blind-signed ballots, client-held receipts) remains designed
          and tested in the repository as the long-term privacy spine; restoring it is a deliberate
          switch, documented in the open-source privacy architecture. Feed submissions still keep
          submitter identity in a sealed ledger only (never on the public feed).
        </p>
        <p className="text-sub">
          See{' '}
          <Link to="/data-rights" className="text-navy underline underline-offset-4">
            your data &amp; rights
          </Link>{' '}
          for exactly what is stored.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('verify.title')}</h2>
        <p className="text-sub">
          {t('verify.checkpoints')}{' '}
          <Link to="/verify" className="text-navy underline underline-offset-4">
            {t('verify.title')} →
          </Link>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Open source</h2>
        <p className="text-sub">
          BharatBol’s entire codebase is public:{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-navy underline underline-offset-4 break-all">
            {REPO_URL}
          </a>
        </p>
      </section>

      <section className="card p-5 text-sm text-sub">{t('disclaimer')}</section>
    </div>
  );
}

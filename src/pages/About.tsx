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
        <h1 className="mt-3 font-display font-bold text-3xl text-navy">About Praja</h1>
      </header>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">The mission</h2>
        <p className="text-sub">
          Praja (प्रजा — “the people”) is a national civic square. It exists so that any Indian
          citizen — whatever party they support, or none — can publicly stand on an issue and be
          counted, verifiably and in the open. It belongs to no movement and no party. It is a call
          to the whole country.
        </p>
        <p className="text-sub">
          Praja’s one promise: <strong className="text-ink">prove how many, never show who.</strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">What the counts mean — honestly</h2>
        <p className="text-sub">
          Every number on Praja counts <strong className="text-ink">verified engaged citizens</strong>:
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

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Rules of the square</h2>
        <ul className="list-disc pl-5 text-sub space-y-2">
          <li>Every stand is about an <strong className="text-ink">issue</strong> — never about a person, party, company, or community.</li>
          <li>Praja never favours or attacks any party. It is the neutral layer above all of them.</li>
          <li>Praja measures sentiment. It never instructs anyone to take any action.</li>
          <li>Standing is free, requires no fee ever, and is revocable by you alone.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Privacy — the honest version</h2>
        <p className="text-sub">
          Publicly, Praja shows only aggregate counts and — with your explicit permission — your
          first name and state on the supporter wall. No public page or public database view carries
          your account identity, email, or full name. You can opt out of the wall, or erase your
          account and all your data, at any time from your profile.
        </p>
        <p className="text-sub">
          One honest trade-off in this first version: to guarantee one-account-one-stand, our
          private database stores which account stood on which issue. That table is never publicly
          readable and is never joined into anything public — but it means the database itself could
          internally link an account to a stand. For neutral, broadly agreeable issues like the ones
          here, we consider that acceptable. Until we ship the fully unlinkable design, Praja will
          not host any sensitive stands. See{' '}
          <Link to="/data-rights" className="text-navy underline underline-offset-4">
            your data &amp; rights
          </Link>{' '}
          for exactly what is stored.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Open source</h2>
        <p className="text-sub">
          Praja’s entire codebase — including the database rules that keep identities private — is
          public, so anyone can verify the promises above:{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-navy underline underline-offset-4 break-all">
            {REPO_URL}
          </a>
        </p>
      </section>

      <section className="card p-5 text-sm text-sub">{t('disclaimer')}</section>
    </div>
  );
}

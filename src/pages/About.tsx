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
          BharatBol’s one promise: <strong className="text-ink">prove how many, never show who.</strong>
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

      {/* Protective block: hard rules that never soften (§C).
          The privacy section below keeps its exact approved wording. */}
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
          Your stands are recorded as <strong className="text-ink">anonymous ballots</strong>. When
          you sign in, your browser obtains blind-signed tokens (RFC 9474) for every live issue at
          once — so the record of issuing them says nothing about what you support — and casting a
          stand presents a token the system provably cannot connect back to any account.
          Account-to-stand linkage is{' '}
          <strong className="text-ink">prevented by design in everything the database stores</strong>:
          the ballot log has no account column at all, and this claim is enforced by automated tests
          in our open-source repository.
        </p>
        <p className="text-sub">
          The honest limits: infrastructure request logs (timing, IP) could in principle correlate
          activity — running the token issuer and the ballot store under separate operators is the
          real fix, and it is on our roadmap. The proof of your own ballots (your receipts) lives
          only in your browser; export them from your profile to withdraw from another device.
          Appearing on the supporter wall is separate and purely voluntary: choosing it links that
          stand to your account in our private database so you keep the right to rename, opt out,
          or erase it — skip the wall to stay fully anonymous. See{' '}
          <Link to="/data-rights" className="text-navy underline underline-offset-4">
            your data &amp; rights
          </Link>{' '}
          for exactly what is stored.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Open source</h2>
        <p className="text-sub">
          BharatBol’s entire codebase — including the database rules that keep identities private — is
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

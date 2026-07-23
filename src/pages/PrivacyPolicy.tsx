import { Link } from 'react-router-dom';
import { REPO_URL } from '../lib/supabase';

/** Public policy used by visitors and by OAuth-provider verification. */
export default function PrivacyPolicy() {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 space-y-8 leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-display font-bold text-3xl text-navy">Privacy Policy</h1>
        <p className="text-sm text-sub">Effective 23 July 2026 · BharatBol</p>
        <p className="text-sub">
          BharatBol is an independent civic platform. This policy explains the personal data used
          when you visit, sign in, take a stand, react, or submit a link.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">What we collect</h2>
        <ul className="list-disc pl-5 text-sub space-y-2">
          <li>
            When you use Google sign-in, our authentication provider receives your Google account
            identifier, email address, and basic profile information needed to create your account.
          </li>
          <li>
            We store your BharatBol profile choices: first name, state, and whether you choose to
            appear on the supporter wall.
          </li>
          <li>
            A stand, feed reaction, or feed submission is recorded against your BharatBol account
            to prevent duplicate activity and operate the service. In the current product mode,
            the database can link an account to its stands and reactions.
          </li>
          <li>
            We process the public link, title, issue, and state you submit to the Feed. The Feed
            never displays the submitter’s identity.
          </li>
          <li>
            Your browser stores a sign-in session and preference data locally. Our hosting and
            service providers may process standard technical request data such as IP address and
            browser information in their logs.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">How we use and show data</h2>
        <p className="text-sub">
          We use data to authenticate you, prevent duplicate activity, show aggregate counts,
          moderate submitted links, respond to reports, and keep the platform secure. Stand and
          reaction totals are shown as aggregates. Your name and state are public only when you
          actively enable the supporter-wall option. Your email and account identifier are never
          displayed publicly.
        </p>
        <p className="text-sub">
          Feed items are links to original third-party posts; BharatBol does not re-host their
          media. Opening or viewing those links is subject to the relevant platform’s own policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Service providers and sharing</h2>
        <p className="text-sub">
          We use Google for sign-in, Supabase for authentication and database services, and
          Cloudflare and Vercel for hosting. These providers process data only as needed to run
          their services. We do not sell personal data or use it for advertising. We may disclose
          information where required by law or to protect the platform and its users.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Your choices and deletion</h2>
        <p className="text-sub">
          You can change your profile and supporter-wall setting at any time. Signed-in users can
          permanently delete their account and associated account-linked profile, stands,
          reactions, and submission-ledger records from <Link to="/me" className="text-navy underline underline-offset-4">Me</Link>.
          Aggregated or de-identified operational records may remain where they no longer identify
          you or where retention is required for security or legal compliance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Contact and changes</h2>
        <p className="text-sub">
          For a privacy question, correction, or request, contact the project operator through the{' '}
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="text-navy underline underline-offset-4">BharatBol repository</a>.
          Do not include sensitive personal data in a public issue.
          We may update this policy as the product changes; the effective date above will change
          with any material update.
        </p>
      </section>

      <p className="card p-5 text-sm text-sub">
        A simpler data inventory and in-app controls are available under <Link to="/data-rights" className="text-navy underline underline-offset-4">Your data &amp; rights</Link>.
      </p>
    </article>
  );
}

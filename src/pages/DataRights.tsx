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
        <h1 className="font-display font-bold text-3xl text-navy">Your data &amp; your rights</h1>
        <p className="mt-2 text-sub">
          Written in the spirit of the Digital Personal Data Protection Act (DPDP), 2023 — in plain
          language.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Everything we store about you</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-sub border-b border-line">
                <th className="p-3 font-semibold">Data</th>
                <th className="p-3 font-semibold">Why</th>
                <th className="p-3 font-semibold">Public?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="p-3">Google account ID &amp; email</td>
                <td className="p-3 text-sub">Sign-in and one-account-one-stand</td>
                <td className="p-3 font-semibold text-green">Never</td>
              </tr>
              <tr>
                <td className="p-3">First name</td>
                <td className="p-3 text-sub">Supporter wall &amp; your citizen card</td>
                <td className="p-3 text-sub">Only if you opt in</td>
              </tr>
              <tr>
                <td className="p-3">State</td>
                <td className="p-3 text-sub">The national map &amp; state counts</td>
                <td className="p-3 text-sub">Only as aggregates / with wall opt-in</td>
              </tr>
              <tr>
                <td className="p-3">Which issues you stand for</td>
                <td className="p-3 text-sub">Counting you once per issue</td>
                <td className="p-3 font-semibold text-green">Never linked to you publicly</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sub text-sm">
          That is the complete list. Praja stores no phone number, no address, no browsing profile,
          and shows no advertising.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Your rights, in one place</h2>
        <ul className="list-disc pl-5 text-sub space-y-2">
          <li><strong className="text-ink">See &amp; correct:</strong> your name, state, and wall preference are editable in your profile.</li>
          <li><strong className="text-ink">Opt out:</strong> untick the wall option and your name disappears from all public walls — retroactively.</li>
          <li><strong className="text-ink">Withdraw:</strong> remove any stand at any time; the public count decreases immediately.</li>
          <li><strong className="text-ink">Erase:</strong> delete your account from your profile page. Your profile, your stands, and your wall entries are permanently removed, and every count adjusts. Nothing is retained.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">Do it now</h2>
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

      <section className="card p-5 text-sm text-sub">{t('disclaimer')}</section>
    </div>
  );
}

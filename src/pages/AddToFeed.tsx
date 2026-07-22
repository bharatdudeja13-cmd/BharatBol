import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { callFeedFn, feedLive } from '../state/useFeed';
import { useI18n } from '../lib/i18n';
import { ISSUES, issueLabel } from '../config/issues';
import { STATES, stateName } from '../lib/states';
import { findSocialUrl, parseSocialUrl, PLATFORM_LABEL } from '../lib/feedUrl';
import { Tilegram } from '../components/Tilegram';

/**
 * Both ingestion paths land here:
 *   A. Web Share Target (installed PWA) → /add?url=…&text=…&title=…
 *   B. Paste (works everywhere, including iOS Safari where Share Target
 *      is unavailable) → the same three steps: link → issue → state.
 *
 * The submitter is never shown publicly; login exists only to rate-limit
 * abuse. Guardrails are linked before submission, not buried after it.
 */
export default function AddToFeed() {
  const [params] = useSearchParams();
  const { session, signIn } = useAuth();
  const { t, lang } = useI18n();

  const [raw, setRaw] = useState('');
  const [issue, setIssue] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'' | 'done' | 'duplicate' | 'limit' | 'error'>('');

  // Share Target hand-off: the URL can arrive in any of the three fields.
  useEffect(() => {
    const shared = [params.get('url'), params.get('text'), params.get('title')]
      .filter(Boolean)
      .join(' ');
    if (shared) {
      const found = findSocialUrl(shared);
      setRaw(found ? found.canon : shared.trim());
    }
  }, [params]);

  const parsed = useMemo(() => parseSocialUrl(raw) ?? findSocialUrl(raw), [raw]);
  const canSubmit = !!parsed && !!issue && !busy;

  const submit = async () => {
    if (!parsed || !issue) return;
    setBusy(true);
    setResult('');
    try {
      if (!feedLive) {
        setResult('done'); // demo mode: nothing is sent anywhere
        return;
      }
      const res = await callFeedFn(
        'feed-submit',
        { url: parsed.canon, issue, state },
        session?.access_token
      );
      const data = (await res.json()) as { duplicate?: boolean };
      if (res.status === 429) setResult('limit');
      else if (!res.ok) setResult('error');
      else setResult(data.duplicate ? 'duplicate' : 'done');
    } catch {
      setResult('error');
    } finally {
      setBusy(false);
    }
  };

  if (feedLive && !session) {
    return (
      <div className="mx-auto max-w-md px-4 pt-20 text-center space-y-6">
        <h1 className="font-display font-bold text-2xl text-navy">{t('add.title')}</h1>
        <p className="text-sub text-sm">{t('add.signIn')}</p>
        <button className="btn-primary" onClick={() => void signIn()}>
          {t('nav.signIn')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-8">
      <header>
        <h1 className="font-display font-bold text-3xl text-navy">{t('add.title')}</h1>
        <p className="text-sub mt-2">{t('add.sub')}</p>
      </header>

      {result === 'done' || result === 'duplicate' ? (
        <div className="card p-6 space-y-4">
          <p className="text-green font-semibold">
            {result === 'duplicate' ? t('add.duplicate') : t('add.done')}
          </p>
          <div className="flex gap-3">
            <Link to="/feed" className="btn-secondary text-sm">
              {t('feed.title')}
            </Link>
            <button
              className="btn-ghost text-sm"
              onClick={() => {
                setRaw('');
                setIssue('');
                setState(null);
                setResult('');
              }}
            >
              + {t('nav.add')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 1 — the link */}
          <section className="space-y-2">
            <label className="block">
              <span className="text-sm font-semibold">1 · {t('add.paste')}</span>
              <input
                type="url"
                inputMode="url"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="https://…"
                className="mt-1.5 w-full rounded-xl border border-line bg-faint px-4 py-3 text-base"
              />
            </label>
            {raw && !parsed && <p className="text-sm text-saffron">{t('add.badUrl')}</p>}
            {parsed && (
              <p className="text-sm text-green font-medium">
                ✓ {t('add.detected')}: {PLATFORM_LABEL[parsed.platform]}
              </p>
            )}
          </section>

          {/* 2 — the issue */}
          <section className="space-y-2">
            <span className="text-sm font-semibold">2 · {t('add.pickIssue')}</span>
            <div className="flex flex-wrap gap-2">
              {ISSUES.map((i) => (
                <button
                  key={i.slug}
                  className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
                    issue === i.slug ? 'bg-navy text-white border-navy' : 'bg-white text-sub border-line'
                  }`}
                  onClick={() => setIssue(i.slug)}
                >
                  {issueLabel(i.slug, lang)}
                </button>
              ))}
            </div>
          </section>

          {/* 3 — the state */}
          <section className="space-y-3">
            <span className="text-sm font-semibold">3 · {t('add.pickState')}</span>
            <Tilegram countsByState={{}} selected={state} onSelect={setState} />
            <select
              value={state ?? ''}
              onChange={(e) => setState(e.target.value || null)}
              className="w-full rounded-xl border border-line bg-faint px-4 py-2.5 text-sm"
              aria-label={t('add.pickState')}
            >
              <option value="">—</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {stateName(s.code, lang)}
                </option>
              ))}
            </select>
          </section>

          {result === 'limit' && <p className="text-sm text-saffron">{t('add.limit')}</p>}
          {result === 'error' && <p className="text-sm text-saffron">{t('misc.error')}</p>}

          <button className="btn-primary w-full" onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? t('add.submitting') : t('add.submit')}
          </button>

          <div className="card p-5 space-y-2 text-sm text-sub">
            <p>{t('add.anon')}</p>
            <p>
              <Link to="/moderation" className="text-navy underline underline-offset-4">
                {t('add.rules')}
              </Link>
            </p>
            <p className="text-xs">{t('add.install')}</p>
          </div>
        </>
      )}
    </div>
  );
}

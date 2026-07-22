import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { callFeedFn, feedLive } from '../state/useFeed';
import { useI18n } from '../lib/i18n';
import { ISSUES, issueLabel } from '../config/issues';
import { STATES, stateName } from '../lib/states';
import {
  findSocialUrl,
  parseSocialUrl,
  PLATFORM_LABEL,
  strippedShareDetails,
} from '../lib/feedUrl';
import { Tilegram } from '../components/Tilegram';

/**
 * Both ingestion paths land here:
 *   A. Web Share Target (installed PWA) → /add?url=…&text=…&title=…
 *   B. Paste (works everywhere, including iOS Safari where Share Target
 *      is unavailable) → the same three steps: link → issue → state.
 *
 * Before submit we rewrite the pasted URL to its canonical public form and
 * drop personal share tags (igsh, fbclid, …) so the stored link cannot be
 * traced back to the person who shared it into BharatBol.
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
  const [errorDetail, setErrorDetail] = useState('');
  const [scrubbed, setScrubbed] = useState(false);

  // Share Target hand-off: the URL can arrive in any of the three fields.
  useEffect(() => {
    const shared = [params.get('url'), params.get('text'), params.get('title')]
      .filter(Boolean)
      .join(' ');
    if (!shared) return;
    const found = findSocialUrl(shared);
    if (found) {
      setScrubbed(strippedShareDetails(shared, found.canon));
      setRaw(found.canon);
    } else {
      setRaw(shared.trim());
    }
  }, [params]);

  const parsed = useMemo(() => parseSocialUrl(raw) ?? findSocialUrl(raw), [raw]);
  const canSubmit = !!parsed && !!issue && !busy;

  // As soon as we recognise a post, replace the field with the clean public URL.
  useEffect(() => {
    if (!parsed) return;
    if (raw.trim() === parsed.canon) return;
    setScrubbed((prev) => prev || strippedShareDetails(raw, parsed.canon));
    setRaw(parsed.canon);
  }, [parsed, raw]);

  const onPasteUrl = (value: string) => {
    const found = parseSocialUrl(value) ?? findSocialUrl(value);
    if (found) {
      setScrubbed(strippedShareDetails(value, found.canon));
      setRaw(found.canon);
      return;
    }
    setScrubbed(false);
    setRaw(value);
  };

  const submit = async () => {
    if (!parsed || !issue) return;
    setBusy(true);
    setResult('');
    setErrorDetail('');
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
      let data: { duplicate?: boolean; error?: string } = {};
      try {
        data = (await res.json()) as { duplicate?: boolean; error?: string };
      } catch {
        /* non-JSON */
      }
      if (res.status === 429) setResult('limit');
      else if (res.status === 401) {
        setResult('error');
        setErrorDetail(t('add.errorAuth'));
      } else if (!res.ok) {
        setResult('error');
        setErrorDetail(data.error ? String(data.error) : t('misc.error'));
      } else setResult(data.duplicate ? 'duplicate' : 'done');
    } catch {
      setResult('error');
      setErrorDetail(t('misc.error'));
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
          <div className="flex flex-wrap gap-3">
            <Link to="/evidence" className="btn-primary text-sm">
              {t('evidence.watchAll')}
            </Link>
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
                setScrubbed(false);
                setErrorDetail('');
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
                onChange={(e) => onPasteUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1.5 w-full rounded-xl border border-line bg-faint px-4 py-3 text-base"
              />
            </label>
            {raw && !parsed && <p className="text-sm text-saffron">{t('add.badUrl')}</p>}
            {parsed && (
              <div className="space-y-1 text-sm">
                <p className="text-green font-medium">
                  ✓ {t('add.detected')}: {PLATFORM_LABEL[parsed.platform]}
                </p>
                {scrubbed && <p className="text-navy font-medium">{t('add.scrubbed')}</p>}
                <p className="text-sub text-xs break-all font-mono">{parsed.canon}</p>
              </div>
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
          {result === 'error' && (
            <p className="text-sm text-saffron">{errorDetail || t('misc.error')}</p>
          )}

          <button className="btn-primary w-full" onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? t('add.submitting') : t('add.submit')}
          </button>

          <div className="card p-5 space-y-2 text-sm text-sub">
            <p>{t('add.anon')}</p>
            <p>{t('add.privacyStrip')}</p>
            <p>
              <Link to="/moderation" className="text-navy underline underline-offset-4">
                {t('add.rules')}
              </Link>
            </p>
          </div>

          <InstallAndShareGuide />
        </>
      )}
    </div>
  );
}

/** Clear install + share-from-app steps; privacy note on share-tag scrubbing. */
function InstallAndShareGuide() {
  const { t } = useI18n();
  return (
    <section className="space-y-4" aria-labelledby="add-install-heading">
      <h2 id="add-install-heading" className="font-display font-semibold text-xl text-navy">
        {t('add.installTitle')}
      </h2>
      <p className="text-sm text-sub">{t('add.installLead')}</p>

      <ol className="space-y-3 text-sm">
        <li className="card p-4 space-y-1">
          <strong className="text-ink">{t('add.installStep1Title')}</strong>
          <p className="text-sub">{t('add.installStep1Body')}</p>
        </li>
        <li className="card p-4 space-y-1">
          <strong className="text-ink">{t('add.installStep2Title')}</strong>
          <p className="text-sub">{t('add.installStep2Body')}</p>
        </li>
        <li className="card p-4 space-y-1">
          <strong className="text-ink">{t('add.installStep3Title')}</strong>
          <p className="text-sub">{t('add.installStep3Body')}</p>
        </li>
      </ol>

      <div className="card p-4 space-y-2 text-sm">
        <strong className="text-ink">{t('add.shareFromTitle')}</strong>
        <ul className="list-disc pl-5 space-y-1.5 text-sub">
          <li>{t('add.shareFromIg')}</li>
          <li>{t('add.shareFromYt')}</li>
          <li>{t('add.shareFromX')}</li>
          <li>{t('add.shareFromFb')}</li>
        </ul>
        <p className="text-navy font-medium pt-1">{t('add.sharePrivacyNote')}</p>
      </div>
    </section>
  );
}

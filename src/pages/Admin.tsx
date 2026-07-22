import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../state/AuthProvider';
import { callFeedFn, feedLive } from '../state/useFeed';
import { useI18n } from '../lib/i18n';
import { ISSUES, issueLabel } from '../config/issues';
import { STATES, stateName } from '../lib/states';
import { PLATFORM_LABEL } from '../lib/feedUrl';
import type { FeedItem } from '../lib/types';

const REJECT_REASONS = [
  'doxxing', 'violence', 'targeting', 'sexual', 'minor', 'misinfo', 'offtopic', 'duplicate', 'other',
] as const;

/**
 * Moderator queue. Access is decided server-side by the sealed `admins`
 * table — this page simply reflects what feed-moderate allows. The queue
 * deliberately carries no submitter identity: moderators judge content.
 */
export default function Admin() {
  const { session, signIn } = useAuth();
  const { t, lang } = useI18n();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!feedLive || !session) return;
    const res = await callFeedFn('feed-moderate', { action: 'list' }, session.access_token);
    if (res.status === 403) {
      setState('denied');
      return;
    }
    const data = (await res.json()) as { items?: FeedItem[] };
    setItems(data.items ?? []);
    setState('ok');
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (item: FeedItem, action: string, extra: Record<string, unknown> = {}) => {
    if (!session) return;
    setBusyId(item.id);
    try {
      await callFeedFn('feed-moderate', { action, id: item.id, ...extra }, session.access_token);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (!feedLive) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-16 text-center">
        <p className="text-sub">{t('verify.demo')}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 pt-20 text-center space-y-6">
        <p className="text-sub">{t('mod.notAdmin')}</p>
        <button className="btn-primary" onClick={() => void signIn()}>
          {t('nav.signIn')}
        </button>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="mx-auto max-w-md px-4 pt-20 text-center">
        <p className="text-sub">{t('mod.notAdmin')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-6">
      <h1 className="font-display font-bold text-3xl text-navy">{t('mod.title')}</h1>

      {state === 'loading' ? (
        <p className="text-sub">{t('misc.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sub">{t('mod.none')}</p>
      ) : (
        items.map((item) => (
          <article key={item.id} className="card p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-sub">{PLATFORM_LABEL[item.platform]}</span>
              <span className="font-mono text-sub">· {item.submitted_on}</span>
              <span className="rounded-full bg-navy/5 text-navy px-2 py-0.5 font-semibold">
                {item.status}
              </span>
              {item.flagged && (
                <span className="rounded-full bg-saffron/15 text-saffron px-2 py-0.5 font-semibold">
                  ⚑ {t('mod.flagged')}
                </span>
              )}
              {!!item.reports && (
                <span className="rounded-full bg-saffron/15 text-saffron px-2 py-0.5 font-semibold">
                  {item.reports} {t('mod.reported')}
                </span>
              )}
            </div>

            {item.title && <h2 className="font-display font-semibold">{item.title}</h2>}
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-navy underline underline-offset-4 break-all"
            >
              {item.url}
            </a>

            <div className="grid grid-cols-2 gap-2">
              <select
                defaultValue={item.issue}
                onChange={(e) => void act(item, 'approve', { issue: e.target.value, state: item.state })}
                className="rounded-xl border border-line bg-faint px-3 py-2 text-sm"
                aria-label="issue"
              >
                {ISSUES.map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {issueLabel(i.slug, lang)}
                  </option>
                ))}
              </select>
              <select
                defaultValue={item.state ?? ''}
                onChange={(e) => void act(item, 'approve', { issue: item.issue, state: e.target.value || null })}
                className="rounded-xl border border-line bg-faint px-3 py-2 text-sm"
                aria-label="state"
              >
                <option value="">—</option>
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {stateName(s.code, lang)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                className="btn-primary text-sm !py-2 !px-4"
                disabled={busyId === item.id}
                onClick={() => void act(item, 'approve', { issue: item.issue, state: item.state })}
              >
                {t('mod.approve')}
              </button>
              <button
                className="btn-secondary text-sm !py-2 !px-4"
                disabled={busyId === item.id}
                onClick={() => void act(item, 'needs_info')}
              >
                {t('mod.needsInfo')}
              </button>
              <select
                className="rounded-full border border-line bg-white px-3 py-2 text-sm text-sub"
                defaultValue=""
                disabled={busyId === item.id}
                onChange={(e) => e.target.value && void act(item, 'reject', { reason: e.target.value })}
                aria-label={t('mod.reason')}
              >
                <option value="">{t('mod.reject')}…</option>
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`policy.reason.${r}` as 'policy.title')}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

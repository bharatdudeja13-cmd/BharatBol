import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../state/AuthProvider';
import { useStands } from '../state/StandsProvider';
import { callFeedFn, feedLive } from '../state/useFeed';
import { useI18n } from '../lib/i18n';
import { ISSUES, issueLabel, type IssueSlug } from '../config/issues';
import { STATES, stateName } from '../lib/states';
import { PLATFORM_LABEL } from '../lib/feedUrl';
import { supabase } from '../lib/supabase';
import type { FeedItem } from '../lib/types';

const REJECT_REASONS = [
  'doxxing', 'violence', 'targeting', 'sexual', 'minor', 'personal', 'misinfo', 'offtopic', 'duplicate', 'other',
] as const;

/**
 * Moderator queue + light stand ops (create / tag states / pin stand-of-the-day).
 * Access is server-side via sealed `admins` table.
 */
export default function Admin() {
  const { session, signIn } = useAuth();
  const { stands, standStates, standOfTheDayId } = useStands();
  const { t, lang } = useI18n();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [approved, setApproved] = useState<FeedItem[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Per-item relevance affirmation — required before an item can be approved. */
  const [affirmed, setAffirmed] = useState<Set<string>>(new Set());
  /** Per-item issue/state corrections a reviewer makes before approving. */
  const [corrections, setCorrections] = useState<Record<string, { issue: string; state: string | null }>>({});

  const [title, setTitle] = useState('');
  const [titleHi, setTitleHi] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<IssueSlug>(ISSUES[0]?.slug ?? 'education');
  const [tagStandId, setTagStandId] = useState('');
  const [tagCodes, setTagCodes] = useState<string[]>([]);
  const [standMsg, setStandMsg] = useState('');

  const load = useCallback(async () => {
    if (!feedLive || !session) return;
    const res = await callFeedFn('feed-moderate', { action: 'list' }, session.access_token);
    if (res.status === 403) {
      setState('denied');
      return;
    }
    const data = (await res.json()) as { items?: FeedItem[] };
    setItems(data.items ?? []);
    const appRes = await callFeedFn('feed-moderate', { action: 'list_approved' }, session.access_token);
    const appData = (await appRes.json()) as { items?: FeedItem[] };
    setApproved(appData.items ?? []);
    setState('ok');
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tagStandId && stands[0]) setTagStandId(stands[0].id);
  }, [stands, tagStandId]);

  useEffect(() => {
    if (!tagStandId) return;
    setTagCodes(standStates[tagStandId] ?? []);
  }, [tagStandId, standStates]);

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

  const setCorrection = (item: FeedItem, patch: { issue?: string; state?: string | null }) =>
    setCorrections((prev) => ({
      ...prev,
      [item.id]: {
        issue: patch.issue ?? prev[item.id]?.issue ?? item.issue,
        state: patch.state !== undefined ? patch.state : prev[item.id]?.state ?? item.state,
      },
    }));

  const toggleAffirm = (id: string, on: boolean) =>
    setAffirmed((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const approveItem = async (item: FeedItem) => {
    const c = corrections[item.id];
    await act(item, 'approve', {
      issue: c?.issue ?? item.issue,
      state: c?.state ?? item.state,
      relevant: true, // gated by the affirmation checkbox in the UI
    });
    toggleAffirm(item.id, false);
  };

  const createStand = async () => {
    if (!supabase || !session || !title.trim()) return;
    setStandMsg('');
    const { data, error } = await supabase
      .from('stands')
      .insert({
        title: title.trim(),
        title_hi: titleHi.trim() || null,
        description: desc.trim() || title.trim(),
        description_hi: null,
        category,
        status: 'live',
      })
      .select('id')
      .single();
    if (error) {
      setStandMsg(error.message);
      return;
    }
    setStandMsg('ok');
    setTitle('');
    setTitleHi('');
    setDesc('');
    if (data?.id) setTagStandId(data.id as string);
    window.location.reload();
  };

  const saveTags = async () => {
    if (!supabase || !session || !tagStandId) return;
    setStandMsg('');
    await supabase.from('stand_states').delete().eq('stand_id', tagStandId);
    if (tagCodes.length) {
      const { error } = await supabase.from('stand_states').insert(
        tagCodes.map((state) => ({ stand_id: tagStandId, state }))
      );
      if (error) {
        setStandMsg(error.message);
        return;
      }
    }
    setStandMsg('ok');
    window.location.reload();
  };

  const pinSotd = async () => {
    if (!supabase || !session || !tagStandId) return;
    setStandMsg('');
    const { error } = await supabase.from('stand_of_the_day').upsert({
      id: true,
      stand_id: tagStandId,
      pinned_on: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setStandMsg(error.message);
      return;
    }
    setStandMsg('ok');
    window.location.reload();
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

  const reReview = items.filter((i) => i.status === 're_review');
  const rest = items.filter((i) => i.status !== 're_review');

  const renderItem = (item: FeedItem) => (
    <article key={item.id} className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-sub">{PLATFORM_LABEL[item.platform]}</span>
        <span className="font-mono text-sub">· {item.submitted_on}</span>
        {item.status === 're_review' ? (
          <span className="rounded-full bg-saffron/20 text-navy px-2 py-0.5 font-semibold">
            {t('mod.reReviewBadge')}
          </span>
        ) : (
          <span className="rounded-full bg-navy/5 text-navy px-2 py-0.5 font-semibold">
            {item.status}
          </span>
        )}
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
          value={corrections[item.id]?.issue ?? item.issue}
          onChange={(e) => setCorrection(item, { issue: e.target.value })}
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
          value={corrections[item.id]?.state ?? item.state ?? ''}
          onChange={(e) => setCorrection(item, { state: e.target.value || null })}
          className="rounded-xl border border-line bg-faint px-3 py-2 text-sm"
          aria-label="state"
        >
          <option value="">{t('add.allIndia')}</option>
          {STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {stateName(s.code, lang)}
            </option>
          ))}
        </select>
      </div>

      {/* Relevance is a required approval criterion. */}
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={affirmed.has(item.id)}
          onChange={(e) => toggleAffirm(item.id, e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#15305E]"
        />
        <span>{t('mod.relevanceAffirm')}</span>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          className="btn-primary text-sm !py-2 !px-4"
          disabled={busyId === item.id || !affirmed.has(item.id)}
          title={affirmed.has(item.id) ? '' : t('mod.relevanceRequired')}
          onClick={() => void approveItem(item)}
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
          value=""
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
  );

  const renderApproved = (item: FeedItem) => (
    <article key={item.id} className="card p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-sub">{PLATFORM_LABEL[item.platform]}</span>
        <span className="rounded-full bg-navy/5 text-navy px-2 py-0.5 font-semibold">
          {issueLabel(item.issue, lang)}
        </span>
        {item.state && (
          <span className="rounded-full bg-faint border border-line text-sub px-2 py-0.5">
            {stateName(item.state, lang)}
          </span>
        )}
      </div>
      {item.title && <p className="text-sm font-medium">{item.title}</p>}
      <a href={item.url} target="_blank" rel="noreferrer noopener" className="text-xs text-navy underline break-all">
        {item.url}
      </a>
      <select
        className="rounded-full border border-line bg-white px-3 py-2 text-sm text-sub"
        value=""
        disabled={busyId === item.id}
        onChange={(e) => e.target.value && void act(item, 'remove', { reason: e.target.value })}
        aria-label={t('mod.remove')}
      >
        <option value="">{t('mod.remove')}…</option>
        {REJECT_REASONS.map((r) => (
          <option key={r} value={r}>
            {t(`policy.reason.${r}` as 'policy.title')}
          </option>
        ))}
      </select>
    </article>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-10">
      <h1 className="font-display font-bold text-3xl text-navy">{t('mod.title')}</h1>

      <section className="card p-5 space-y-4">
        <h2 className="font-display font-semibold text-xl text-navy">{t('admin.standsTitle')}</h2>
        {standOfTheDayId && (
          <p className="text-xs text-sub font-mono">SOTD: {standOfTheDayId.slice(0, 8)}…</p>
        )}
        <label className="block text-sm">
          <span className="font-semibold">{t('admin.newStand')} (EN)</span>
          <input
            className="mt-1 w-full rounded-xl border border-line bg-faint px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{t('admin.newStand')} (HI)</span>
          <input
            className="mt-1 w-full rounded-xl border border-line bg-faint px-3 py-2"
            value={titleHi}
            onChange={(e) => setTitleHi(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Description</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-line bg-faint px-3 py-2"
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </label>
        <select
          className="w-full rounded-xl border border-line bg-faint px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as IssueSlug)}
        >
          {ISSUES.map((i) => (
            <option key={i.slug} value={i.slug}>
              {issueLabel(i.slug, lang)}
            </option>
          ))}
        </select>
        <button className="btn-primary text-sm" type="button" onClick={() => void createStand()}>
          {t('admin.saveStand')}
        </button>

        <hr className="border-line" />

        <label className="block text-sm">
          <span className="font-semibold">{t('admin.tagStates')}</span>
          <select
            className="mt-1 w-full rounded-xl border border-line bg-faint px-3 py-2"
            value={tagStandId}
            onChange={(e) => setTagStandId(e.target.value)}
          >
            {stands.map((s) => (
              <option key={s.id} value={s.id}>
                {lang === 'hi' && s.title_hi ? s.title_hi : s.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          {STATES.map((s) => {
            const on = tagCodes.includes(s.code);
            return (
              <button
                key={s.code}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  on ? 'bg-navy text-white border-navy' : 'border-line text-sub'
                }`}
                onClick={() =>
                  setTagCodes((prev) =>
                    on ? prev.filter((c) => c !== s.code) : [...prev, s.code]
                  )
                }
              >
                {s.code}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary text-sm" type="button" onClick={() => void saveTags()}>
            {t('admin.saveStand')}
          </button>
          <button className="btn-primary text-sm" type="button" onClick={() => void pinSotd()}>
            {t('admin.pinSotd')}
          </button>
        </div>
        {standMsg && (
          <p className={`text-sm ${standMsg === 'ok' ? 'text-green' : 'text-saffron'}`}>{standMsg}</p>
        )}
      </section>

      {state === 'loading' ? (
        <p className="text-sub">{t('misc.loading')}</p>
      ) : (
        <>
          {items.length === 0 && <p className="text-sub">{t('mod.none')}</p>}
          {reReview.length > 0 && (
            <section className="space-y-3" aria-label={t('mod.sectionReReview')}>
              <h2 className="font-display font-semibold text-lg text-navy">
                {t('mod.sectionReReview')}
              </h2>
              {reReview.map(renderItem)}
            </section>
          )}
          {rest.length > 0 && (
            <section className="space-y-3" aria-label={t('mod.sectionNew')}>
              {reReview.length > 0 && (
                <h2 className="font-display font-semibold text-lg text-navy">
                  {t('mod.sectionNew')}
                </h2>
              )}
              {rest.map(renderItem)}
            </section>
          )}
          {approved.length > 0 && (
            <section className="space-y-3" aria-label={t('mod.sectionApproved')}>
              <h2 className="font-display font-semibold text-lg text-navy">
                {t('mod.sectionApproved')}
              </h2>
              {approved.map(renderApproved)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

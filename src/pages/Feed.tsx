import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFeed, callFeedFn, feedLive } from '../state/useFeed';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { ISSUES, issueLabel } from '../config/issues';
import { STATES, stateName } from '../lib/states';
import { FeedCard } from '../components/FeedCard';
import { evidenceWatchPath } from '../state/useEvidence';
import { fmt } from '../lib/format';
import type { FeedItem, Stand } from '../lib/types';
import { PwaInstallButton } from '../components/PwaInstallButton';

const REPORT_REASONS = [
  'doxxing', 'violence', 'targeting', 'sexual', 'minor', 'misinfo', 'offtopic', 'copyright', 'other',
] as const;

export default function Feed() {
  const { items, loading, reload } = useFeed();
  const { stands, counts } = useStands();
  const { t, lang } = useI18n();
  const [issue, setIssue] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [reporting, setReporting] = useState<FeedItem | null>(null);
  const [reason, setReason] = useState<string>('');
  const [reported, setReported] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) => (!issue || i.issue === issue) && (!state || i.state === state)
      ),
    [items, issue, state]
  );

  /** Group evidences under matching open stands (by issue category). */
  const groups = useMemo(() => {
    const byIssue = new Map<string, FeedItem[]>();
    for (const item of filtered) {
      const list = byIssue.get(item.issue) ?? [];
      list.push(item);
      byIssue.set(item.issue, list);
    }
    const out: { stand: Stand | null; issue: string; items: FeedItem[] }[] = [];
    for (const stand of stands) {
      const list = byIssue.get(stand.category);
      if (list?.length) {
        out.push({ stand, issue: stand.category, items: list });
        byIssue.delete(stand.category);
      }
    }
    for (const [iss, list] of byIssue) {
      out.push({ stand: null, issue: iss, items: list });
    }
    return out;
  }, [filtered, stands]);

  const submitReport = async () => {
    if (!reporting || !reason) return;
    if (feedLive) await callFeedFn('feed-report', { id: reporting.id, reason });
    setReported(true);
    setReporting(null);
    setReason('');
    window.setTimeout(() => setReported(false), 4000);
    if (feedLive) void reload();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-navy">{t('feed.title')}</h1>
          <p className="text-sub mt-2">{t('feed.sub')}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Link to="/add" className="btn-primary text-sm !py-2 !px-4">
            + {t('nav.add')}
          </Link>
          <Link to="/evidence" className="btn-secondary text-sm !py-2 !px-4 text-center">
            {t('evidence.watchAll')}
          </Link>
          <PwaInstallButton className="btn-ghost text-sm !py-2 !px-4" />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          <button
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
              issue === '' ? 'bg-navy text-white border-navy' : 'bg-white text-sub border-line'
            }`}
            onClick={() => setIssue('')}
          >
            {t('feed.allIssues')}
          </button>
          {ISSUES.map((i) => (
            <button
              key={i.slug}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
                issue === i.slug ? 'bg-navy text-white border-navy' : 'bg-white text-sub border-line'
              }`}
              onClick={() => setIssue(i.slug)}
            >
              {issueLabel(i.slug, lang)}
            </button>
          ))}
        </div>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="w-full rounded-xl border border-line bg-faint px-4 py-2.5 text-sm"
          aria-label={t('feed.allStates')}
        >
          <option value="">{t('feed.allStates')}</option>
          {STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {stateName(s.code, lang)}
            </option>
          ))}
        </select>
      </div>

      {reported && (
        <p className="mt-6 card p-4 text-sm text-green font-medium">{t('feed.reportSent')}</p>
      )}

      {loading ? (
        <p className="mt-10 text-sub">{t('misc.loading')}</p>
      ) : groups.length === 0 ? (
        <p className="mt-10 text-sub">{t('feed.empty')}</p>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((g) => {
            const title = g.stand
              ? lang === 'hi' && g.stand.title_hi
                ? g.stand.title_hi
                : g.stand.title
              : issueLabel(g.issue, lang);
            const standing = g.stand ? counts[g.stand.id]?.total ?? 0 : 0;
            return (
              <section key={g.stand?.id ?? g.issue} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-xl text-navy">{title}</h2>
                    <p className="text-xs text-sub mt-1">
                      {fmt(g.items.length)} {t('evidence.clipCount')}
                      {g.stand ? ` · ${fmt(standing)} ${t('counts.standing')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={evidenceWatchPath({
                        issue: g.issue,
                        state: state || null,
                        stand: g.stand?.id,
                        id: g.items[0]?.id,
                      })}
                      className="btn-primary text-sm !py-2 !px-4"
                    >
                      {t('evidence.watchAll')}
                    </Link>
                    {g.stand && (
                      <Link to={`/stand/${g.stand.id}`} className="btn-secondary text-sm !py-2 !px-4">
                        {t('stand.standWith')}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="space-y-5">
                  {g.items.map((item) => (
                    <FeedCard key={item.id} item={item} onReport={setReporting} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-sub">
        <Link to="/moderation" className="underline underline-offset-4 hover:text-navy">
          {t('policy.title')}
        </Link>
      </p>

      {reporting && (
        <div
          className="fixed inset-0 z-50 bg-navyDeep/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          onClick={(e) => e.target === e.currentTarget && setReporting(null)}
        >
          <div className="card w-full max-w-md p-6 space-y-4">
            <h2 id="report-title" className="font-display font-semibold text-xl">
              {t('feed.reportTitle')}
            </h2>
            <p className="text-sm text-sub">{t('feed.reportSub')}</p>
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="w-4 h-4 accent-[#15305E]"
                  />
                  <span>{t(`policy.reason.${r}` as 'policy.title')}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setReporting(null)}>
                {t('join.cancel')}
              </button>
              <button className="btn-primary flex-1" onClick={() => void submitReport()} disabled={!reason}>
                {t('feed.report')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

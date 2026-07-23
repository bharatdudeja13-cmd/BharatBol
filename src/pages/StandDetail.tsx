import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStands } from '../state/StandsProvider';
import { hashtagBlock } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import { LiveNumber } from '../components/LiveNumber';
import { SupporterWall } from '../components/SupporterWall';
import { StateBars } from '../components/StateBars';
import { EvidenceStrip } from '../components/EvidenceStrip';
import { useEvidence } from '../state/useEvidence';
import { usePublicStandLedger } from '../state/usePublicStandLedger';
import { fmt } from '../lib/format';
import { REPO_URL } from '../lib/supabase';

export default function StandDetail() {
  const { id } = useParams<{ id: string }>();
  const { stands, counts, wall, breakdown, joined, requestStand, withdraw, setShareFor, loading } =
    useStands();
  const { t, lang } = useI18n();
  const stand = stands.find((s) => s.public_id === id || s.id === id);
  const standId = stand?.id;
  const { record: publicLedger, status: ledgerStatus, refresh: refreshLedger } =
    usePublicStandLedger(standId);
  const { items: evidence } = useEvidence({ issue: stand?.category, limit: 24, enabled: !!stand });
  const standWall = useMemo(() => wall.filter((w) => w.stand_id === standId), [wall, standId]);
  const standStates = useMemo(
    () => breakdown.filter((r) => r.stand_id === standId).map((r) => ({ state: r.state, count: r.count })),
    [breakdown, standId]
  );

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 pt-16 text-sub">{t('misc.loading')}</p>;
  }
  if (!stand) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-16 text-center space-y-4">
        <p className="text-sub">{t('stand.notFound')}</p>
        <Link to="/stands" className="btn-secondary">
          {t('stand.seeAll')}
        </Link>
      </div>
    );
  }

  const c = counts[stand.id] ?? { total: 0, today: 0 };
  /** Prefer anonymous public stand_counts; fall back to page counts in demo. */
  const ledger = publicLedger ?? { total: c.total, today: c.today };
  const isJoined = joined.has(stand.id);
  const title = lang === 'hi' && stand.title_hi ? stand.title_hi : stand.title;
  const desc = lang === 'hi' && stand.description_hi ? stand.description_hi : stand.description;

  const ledgerNote =
    ledgerStatus === 'demo'
      ? t('ledger.demoNote')
      : ledgerStatus === 'error'
        ? t('ledger.errorNote')
        : t('ledger.liveNote');

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <Link to="/stands" className="text-sm text-sub hover:text-navy">
        ← {t('stand.seeAll')}
      </Link>

      <div className="mt-4 flex items-center gap-2 text-xs font-mono text-sub">
        <span className="inline-flex items-center gap-1.5 text-green">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" aria-hidden="true" />
          {t('stand.live')}
        </span>
        <span aria-hidden="true">·</span>
        <span className="uppercase tracking-wide">{stand.category}</span>
      </div>

      <h1 className="mt-3 font-display font-bold text-3xl sm:text-4xl leading-tight text-ink">{title}</h1>
      <p className="mt-2 font-mono text-sm font-semibold text-saffron">{hashtagBlock(stand)}</p>
      <p className="mt-4 text-sub leading-relaxed">{desc}</p>
      {stand.source_url && (
        <p className="mt-4 rounded-xl border border-line bg-faint px-4 py-3 text-sm text-sub">
          <span className="font-semibold text-navy">Evidence:</span>{' '}
          <a
            href={stand.source_url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-navy underline underline-offset-4"
          >
            {stand.source_label || 'Published source'}
          </a>
          {stand.source_published_on ? ` · ${stand.source_published_on}` : ''}
        </p>
      )}

      {/* Big live counter + action */}
      <div className="card mt-8 p-6 sm:p-8 text-center">
        <LiveNumber value={c.total} className="font-display font-bold text-5xl sm:text-6xl text-navy tabular-nums" />
        <p className="mt-2 text-sub">
          {t('counts.standing')}
          {c.today > 0 && (
            <span className="text-green font-semibold"> · +{fmt(c.today)} {t('counts.today')}</span>
          )}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            className={isJoined ? 'btn-secondary text-base px-8' : 'btn-primary text-base px-8'}
            onClick={() => void requestStand(stand)}
          >
            {isJoined ? '✓ ' + t('stand.standing') : t('stand.standWith')}
          </button>
          <button className="btn-secondary" onClick={() => setShareFor(stand)}>
            {t('campaign.start')}
          </button>
        </div>
        <p className="mt-3 text-sm text-sub italic">{t('campaign.line')}</p>
        {isJoined && (
          <button
            className="mt-4 text-xs text-sub underline underline-offset-4 hover:text-navy"
            onClick={() => void withdraw(stand.id)}
          >
            {t('stand.withdraw')}
          </button>
        )}
        <p className="mt-4 text-[11px] text-sub font-mono">{t('counts.verified')}</p>
      </div>

      {/* Public ledger - readable without signing in */}
      <section className="mt-10" aria-labelledby="stand-ledger-heading">
        <h2 id="stand-ledger-heading" className="font-display font-semibold text-xl">
          {t('ledger.title')}
        </h2>
        <p className="text-sm text-sub mt-1 mb-4">{t('ledger.sub')}</p>
        <div className="card p-5 sm:p-6 space-y-4">
          <dl className="grid grid-cols-2 gap-4 text-center sm:text-left">
            <div>
              <dt className="text-xs font-mono uppercase tracking-wide text-sub">{t('ledger.total')}</dt>
              <dd className="mt-1 font-display font-bold text-2xl text-navy tabular-nums">
                {ledgerStatus === 'loading' ? '…' : fmt(ledger.total)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-mono uppercase tracking-wide text-sub">{t('ledger.today')}</dt>
              <dd className="mt-1 font-display font-bold text-2xl text-navy tabular-nums">
                {ledgerStatus === 'loading' ? '…' : fmt(ledger.today)}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-sub leading-relaxed">{t('ledger.rule')}</p>
          <p className="text-[11px] text-sub font-mono">{ledgerNote}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {ledgerStatus !== 'demo' && (
              <button
                type="button"
                className="text-navy underline underline-offset-4 font-medium"
                onClick={() => void refreshLedger()}
                disabled={ledgerStatus === 'loading'}
              >
                {ledgerStatus === 'loading' ? t('misc.loading') : t('ledger.refresh')}
              </button>
            )}
            <Link to="/verify" className="text-navy underline underline-offset-4 font-medium">
              {t('ledger.verify')} →
            </Link>
            <a
              href={`${REPO_URL}/tree/develop/checkpoints`}
              target="_blank"
              rel="noreferrer"
              className="text-navy underline underline-offset-4"
            >
              {t('ledger.checkpoints')}
            </a>
          </div>
        </div>
      </section>

      {/* Evidences for this issue */}
      <section className="mt-10">
        <EvidenceStrip items={evidence} issue={stand.category} />
      </section>

      {/* State breakdown */}
      {standStates.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display font-semibold text-xl mb-4">{t('map.title')}</h2>
          <StateBars rows={standStates} />
        </section>
      )}

      {/* Mini supporter wall */}
      <section className="mt-10">
        <h2 className="font-display font-semibold text-xl">{t('wall.title')}</h2>
        <p className="text-sm text-sub mt-1 mb-4">{t('wall.sub')}</p>
        <SupporterWall entries={standWall} limit={16} />
      </section>
    </div>
  );
}

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
import { fmt } from '../lib/format';

export default function StandDetail() {
  const { id } = useParams<{ id: string }>();
  const { stands, counts, wall, breakdown, joined, requestStand, withdraw, setShareFor, loading } =
    useStands();
  const { t, lang } = useI18n();

  const stand = stands.find((s) => s.id === id);
  const { items: evidence } = useEvidence({ issue: stand?.category, limit: 24, enabled: !!stand });
  const standWall = useMemo(() => wall.filter((w) => w.stand_id === id), [wall, id]);
  const standStates = useMemo(
    () => breakdown.filter((r) => r.stand_id === id).map((r) => ({ state: r.state, count: r.count })),
    [breakdown, id]
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
  const isJoined = joined.has(stand.id);
  const title = lang === 'hi' && stand.title_hi ? stand.title_hi : stand.title;
  const desc = lang === 'hi' && stand.description_hi ? stand.description_hi : stand.description;

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

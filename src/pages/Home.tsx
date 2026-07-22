import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { LiveNumber } from '../components/LiveNumber';
import { StandCard } from '../components/StandCard';
import { StandMarquee } from '../components/StandMarquee';
import { SupporterWall } from '../components/SupporterWall';
import { Tilegram } from '../components/Tilegram';
import { AshokaChakra } from '../components/AshokaChakra';
import { NationalFlag } from '../components/NationalFlag';
import { EvidenceStrip } from '../components/EvidenceStrip';
import { useEvidence, useEvidenceCount, evidenceWatchPath } from '../state/useEvidence';
import { fmt } from '../lib/format';
import { stateName } from '../lib/states';
import { PwaInstallButton } from '../components/PwaInstallButton';

export default function Home() {
  const { stands, counts, national, wall, breakdown, standStates, standOfTheDayId, loading } =
    useStands();
  const { t, lang } = useI18n();
  const [selState, setSelState] = useState<string | null>(null);
  const { items: stateEvidence, loading: evidenceLoading } = useEvidence({
    state: selState,
    limit: 24,
    enabled: !!selState,
  });
  const { total: evidenceTotal } = useEvidenceCount();

  const todayTotal = useMemo(
    () => Object.values(counts).reduce((a, c) => a + c.today, 0),
    [counts]
  );
  const countsByState = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of breakdown) m[r.state] = (m[r.state] ?? 0) + r.count;
    return m;
  }, [breakdown]);

  /** All live stands are open nationally; optional tags = especially relevant here. */
  const openStands = useMemo(() => {
    if (!selState) return [];
    return [...stands].sort((a, b) => {
      const aTag = (standStates[a.id] ?? []).includes(selState) ? 0 : 1;
      const bTag = (standStates[b.id] ?? []).includes(selState) ? 0 : 1;
      if (aTag !== bTag) return aTag - bTag;
      const aCount = breakdown.find((r) => r.stand_id === a.id && r.state === selState)?.count ?? 0;
      const bCount = breakdown.find((r) => r.stand_id === b.id && r.state === selState)?.count ?? 0;
      return bCount - aCount;
    });
  }, [stands, standStates, breakdown, selState]);

  const featured = useMemo(
    () => (standOfTheDayId ? stands.find((s) => s.id === standOfTheDayId) : null) ?? stands[0] ?? null,
    [stands, standOfTheDayId]
  );

  const localCount = (standId: string) =>
    selState
      ? (breakdown.find((r) => r.stand_id === standId && r.state === selState)?.count ?? 0)
      : 0;

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="pt-8 pb-8 text-center">
        <NationalFlag className="mb-6" />
        <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono uppercase tracking-widest text-sub">
          <AshokaChakra size={16} /> {t('app.kicker')}
        </p>
        <h1 className="mt-5 font-display font-bold text-navy leading-none">
          <span className="block font-display text-3xl sm:text-4xl text-navy mb-4">{t('app.name')}</span>
          <LiveNumber value={national} className="block text-5xl sm:text-7xl tabular-nums" />
          <span className="block mt-3 text-lg sm:text-xl font-semibold text-ink">
            {t('counts.taken')}
            {todayTotal > 0 && (
              <span className="text-green"> · +{fmt(todayTotal)} {t('counts.today')}</span>
            )}
          </span>
        </h1>
        {evidenceTotal > 0 && (
          <p className="mt-4 text-sm sm:text-base text-sub">
            <Link to="/feed" className="font-semibold text-navy underline underline-offset-4">
              <span className="tabular-nums">{fmt(evidenceTotal)}</span> {t('home.evidenceCount')}
            </Link>
          </p>
        )}
        <p className="mt-4 font-display text-xl sm:text-2xl text-navy max-w-lg mx-auto leading-snug">
          {t('app.tagline')}
        </p>
        <p className="mt-3 max-w-md mx-auto text-sub leading-relaxed text-sm sm:text-base">
          {t('app.sub')}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/stands" className="btn-primary text-base px-8 min-h-12">
            {t('hero.ctaStand')}
          </Link>
          <Link to="/feed" className="btn-secondary text-base min-h-12">
            {t('nav.feed')}
          </Link>
          <PwaInstallButton className="btn-ghost text-base min-h-12" />
        </div>
        <p className="mt-4 text-xs text-sub font-mono">{t('counts.verified')}</p>
      </section>

      {featured && (
        <section className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest text-saffron mb-2">
            {t('home.standOfDay')}
          </p>
          <StandCard stand={featured} />
        </section>
      )}

      <section className="mt-2" id="map">
        <h2 className="font-display font-semibold text-2xl">{t('map.title')}</h2>
        <p className="text-sm text-sub mt-1 mb-5">{t('map.sub')}</p>
        <Tilegram countsByState={countsByState} selected={selState} onSelect={setSelState} />
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-sub" aria-hidden="true">
          <span>{t('map.legendLow')}</span>
          {['#E7EBF1', '#A9C3D9', '#5F8FBF', '#2E5E9E', '#15305E'].map((c) => (
            <span key={c} className="inline-block w-5 h-3 rounded" style={{ backgroundColor: c }} />
          ))}
          <span>{t('map.legendHigh')}</span>
        </div>

        {selState && (
          <div className="mt-6 rounded-t-3xl border border-line bg-white shadow-lift p-5 space-y-5 pb-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold text-lg">
                  {stateName(selState, lang)}
                </h3>
                <p className="text-sm text-sub mt-0.5">
                  {fmt(countsByState[selState] ?? 0)} {t('map.inState')} · {openStands.length}{' '}
                  {t('map.openStands')} · {stateEvidence.length} {t('map.evidenceCount')}
                </p>
              </div>
              <Link
                to={evidenceWatchPath({ state: selState })}
                className="btn-primary text-sm !py-2.5 !px-4 min-h-11"
              >
                {t('evidence.viewState')}
              </Link>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-navy mb-2">{t('map.openStandsTitle')}</h4>
              {openStands.length === 0 ? (
                <p className="text-sm text-sub">{t('map.noData')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {openStands.map((stand) => {
                    const especially = (standStates[stand.id] ?? []).includes(selState);
                    return (
                      <li key={stand.id}>
                        <Link
                          to={`/stand/${stand.id}`}
                          className="flex items-center justify-between gap-4 py-3.5 min-h-12 hover:text-navy"
                        >
                          <span className="text-sm font-medium">
                            {lang === 'hi' && stand.title_hi ? stand.title_hi : stand.title}
                            {especially && (
                              <span className="ml-2 text-[10px] font-mono uppercase tracking-wide text-saffron">
                                {t('map.especially')}
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-sm text-navy tabular-nums shrink-0">
                            {fmt(localCount(stand.id))}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <EvidenceStrip
              items={stateEvidence}
              state={selState}
              loading={evidenceLoading}
              title={`${t('evidence.title')} · ${stateName(selState, lang)}`}
            />
          </div>
        )}
      </section>

      {!loading && stands.length > 0 && <StandMarquee stands={stands} />}

      <section className="mt-12 mb-4">
        <h2 className="font-display font-semibold text-2xl">{t('wall.title')}</h2>
        <p className="text-sm text-sub mt-1 mb-5">{t('wall.sub')}</p>
        <SupporterWall entries={wall} limit={24} />
      </section>
    </div>
  );
}

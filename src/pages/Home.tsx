import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { LiveNumber } from '../components/LiveNumber';
import { StandCard } from '../components/StandCard';
import { SupporterWall } from '../components/SupporterWall';
import { Tilegram } from '../components/Tilegram';
import { AshokaChakra } from '../components/AshokaChakra';
import { fmt } from '../lib/format';
import { stateName } from '../lib/states';

export default function Home() {
  const { stands, counts, national, wall, breakdown, loading } = useStands();
  const { t, lang } = useI18n();
  const [selState, setSelState] = useState<string | null>(null);

  const todayTotal = useMemo(
    () => Object.values(counts).reduce((a, c) => a + c.today, 0),
    [counts]
  );
  const countsByState = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of breakdown) m[r.state] = (m[r.state] ?? 0) + r.count;
    return m;
  }, [breakdown]);
  const stateStandRows = useMemo(
    () =>
      selState
        ? breakdown
            .filter((r) => r.state === selState)
            .sort((a, b) => b.count - a.count)
        : [],
    [breakdown, selState]
  );

  return (
    <div className="mx-auto max-w-5xl px-4">
      {/* Hero */}
      <section className="pt-14 pb-10 text-center">
        <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono uppercase tracking-widest text-sub">
          <AshokaChakra size={16} /> {t('app.kicker')}
        </p>
        <h1 className="mt-6 font-display font-bold text-navy leading-none">
          <LiveNumber value={national} className="block text-6xl sm:text-8xl tabular-nums" />
          <span className="block mt-3 text-xl sm:text-2xl font-semibold text-ink">
            {t('counts.taken')}
            {todayTotal > 0 && (
              <span className="text-green"> · +{fmt(todayTotal)} {t('counts.today')}</span>
            )}
          </span>
        </h1>
        <p className="mt-4 font-display text-2xl sm:text-3xl text-navy">{t('app.tagline')}</p>
        <p className="mt-3 max-w-xl mx-auto text-sub leading-relaxed">{t('app.sub')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/stands" className="btn-primary text-base px-8">
            {t('hero.ctaStand')}
          </Link>
          <Link to="/about" className="btn-secondary text-base">
            {t('hero.ctaAbout')}
          </Link>
        </div>
        <p className="mt-5 text-xs text-sub font-mono">{t('counts.verified')}</p>
      </section>

      {/* Rotating strip of live stands */}
      {!loading && stands.length > 0 && (
        <section className="marquee overflow-hidden -mx-4 px-4 py-2" aria-label={t('nav.stands')}>
          <div className="marquee-track flex gap-4 w-max">
            {[...stands, ...stands].map((s, i) => (
              <StandCard key={`${s.id}-${i}`} stand={s} compact />
            ))}
          </div>
        </section>
      )}

      {/* Supporter wall */}
      <section className="mt-14">
        <h2 className="font-display font-semibold text-2xl">{t('wall.title')}</h2>
        <p className="text-sm text-sub mt-1 mb-5">{t('wall.sub')}</p>
        <SupporterWall entries={wall} limit={24} />
      </section>

      {/* National tilegram */}
      <section className="mt-14" id="map">
        <h2 className="font-display font-semibold text-2xl">{t('map.title')}</h2>
        <p className="text-sm text-sub mt-1 mb-6">{t('map.sub')}</p>
        <Tilegram countsByState={countsByState} selected={selState} onSelect={setSelState} />
        {selState && (
          <div className="card mt-6 p-5">
            <h3 className="font-display font-semibold text-lg">
              {fmt(countsByState[selState] ?? 0)} {t('map.inState')} {stateName(selState, lang)}
            </h3>
            {stateStandRows.length === 0 ? (
              <p className="text-sm text-sub mt-2">{t('map.noData')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {stateStandRows.map((r) => {
                  const stand = stands.find((s) => s.id === r.stand_id);
                  if (!stand) return null;
                  return (
                    <li key={r.stand_id}>
                      <Link
                        to={`/stand/${stand.id}`}
                        className="flex items-center justify-between gap-4 py-3 hover:text-navy"
                      >
                        <span className="text-sm font-medium">
                          {lang === 'hi' && stand.title_hi ? stand.title_hi : stand.title}
                        </span>
                        <span className="font-mono text-sm text-navy tabular-nums">{fmt(r.count)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

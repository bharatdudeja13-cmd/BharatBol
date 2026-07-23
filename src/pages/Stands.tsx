import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { StandCard } from '../components/StandCard';
import { stateName } from '../lib/states';
import {
  buildStandSections,
  parseGeoParam,
  taggedStateCodes,
  type GeoFilter,
} from '../lib/standsGeography';

export default function Stands() {
  const { stands, standStates, loading } = useStands();
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<GeoFilter>(() =>
    parseGeoParam(params.get('geo') ?? params.get('state'))
  );
  const [query, setQuery] = useState(() => params.get('q') ?? '');

  useEffect(() => {
    setFilter(parseGeoParam(params.get('geo') ?? params.get('state')));
    setQuery(params.get('q') ?? '');
  }, [params]);

  const setGeo = (next: GeoFilter) => {
    setFilter(next);
    const p = new URLSearchParams();
    if (next === 'national') p.set('geo', 'national');
    else if (next !== 'all') p.set('state', next);
    const q = query.trim();
    if (q) p.set('q', q);
    setParams(p, { replace: true });
  };

  const onSearchChange = (value: string) => {
    setQuery(value);
    const p = new URLSearchParams();
    if (filter === 'national') p.set('geo', 'national');
    else if (filter !== 'all') p.set('state', filter);
    const q = value.trim();
    if (q) p.set('q', q);
    setParams(p, { replace: true });
  };

  const qNorm = query.trim().toLowerCase();

  const stateChips = useMemo(() => taggedStateCodes(standStates), [standStates]);

  const sections = useMemo(() => {
    // Pure geography rules live in standsGeography (tested); the component
    // only decorates each section with its localized title + hint.
    return buildStandSections(stands, standStates, filter, qNorm).map((sec) => ({
      ...sec,
      title:
        sec.key === 'national' ? t('stands.national') : stateName(sec.key, lang) || sec.key,
      hint: sec.key === 'national' ? t('stands.nationalHint') : t('stands.stateHint'),
    }));
  }, [filter, stands, standStates, t, lang, qNorm]);

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
      active ? 'bg-navy text-white border-navy' : 'bg-white text-sub border-line'
    }`;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 pb-8">
      <h1 className="font-display font-bold text-3xl text-navy">{t('nav.stands')}</h1>
      <p className="text-sub mt-2 max-w-xl">{t('stands.sub')}</p>

      <label className="mt-6 block">
        <span className="sr-only">{t('stands.search')}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('stands.searchPlaceholder')}
          className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm min-h-12 focus:outline-none focus:ring-2 focus:ring-saffron/60"
          autoComplete="off"
        />
      </label>

      {!loading && stands.length > 0 && (
        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4"
          role="tablist"
          aria-label={t('stands.filterLabel')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={chipClass(filter === 'all')}
            onClick={() => setGeo('all')}
          >
            {t('stands.all')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'national'}
            className={chipClass(filter === 'national')}
            onClick={() => setGeo('national')}
          >
            {t('stands.national')}
          </button>
          {stateChips.map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={filter === code}
              className={chipClass(filter === code)}
              onClick={() => setGeo(code)}
            >
              {stateName(code, lang)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-sub">{t('misc.loading')}</p>
      ) : stands.length === 0 ? (
        <p className="mt-10 text-sub">{t('map.noData')}</p>
      ) : sections.length === 0 || sections.every((s) => s.items.length === 0) ? (
        <p className="mt-10 text-sub">
          {qNorm ? t('stands.emptySearch') : t('stands.emptyFilter')}
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {sections.map((section) =>
            section.items.length === 0 ? null : (
              <section key={section.key} aria-labelledby={`stands-geo-${section.key}`}>
                <div className="mb-4">
                  <h2
                    id={`stands-geo-${section.key}`}
                    className="font-display font-semibold text-xl text-navy"
                  >
                    {section.title}
                  </h2>
                  <p className="text-xs text-sub mt-1">{section.hint}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {section.items.map((s) => (
                    <StandCard key={`${section.key}-${s.id}`} stand={s} />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { StandCard } from '../components/StandCard';
import { STATES, stateName } from '../lib/states';
import type { Stand } from '../lib/types';

/** all | national (untagged) | state code. Default is all — not the signed-in home state. */
type GeoFilter = 'all' | 'national' | string;

function parseGeoParam(raw: string | null): GeoFilter {
  if (!raw || raw === 'all') return 'all';
  if (raw === 'national' || raw === 'all-india') return 'national';
  return raw;
}

export default function Stands() {
  const { stands, standStates, loading } = useStands();
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<GeoFilter>(() =>
    parseGeoParam(params.get('geo') ?? params.get('state'))
  );

  useEffect(() => {
    setFilter(parseGeoParam(params.get('geo') ?? params.get('state')));
  }, [params]);

  const setGeo = (next: GeoFilter) => {
    setFilter(next);
    if (next === 'all') {
      setParams({}, { replace: true });
    } else if (next === 'national') {
      setParams({ geo: 'national' }, { replace: true });
    } else {
      setParams({ state: next }, { replace: true });
    }
  };

  /** States that have at least one tagged stand, in tilegram order. */
  const taggedStateCodes = useMemo(() => {
    const present = new Set<string>();
    for (const codes of Object.values(standStates)) {
      for (const c of codes) present.add(c);
    }
    return STATES.map((s) => s.code).filter((c) => present.has(c));
  }, [standStates]);

  const sections = useMemo(() => {
    const tagsFor = (id: string) => standStates[id] ?? [];
    const national = stands.filter((s) => tagsFor(s.id).length === 0);
    const forState = (code: string) => stands.filter((s) => tagsFor(s.id).includes(code));

    const out: { key: string; title: string; hint: string; items: Stand[] }[] = [];
    if (filter === 'all' || filter === 'national') {
      if (national.length > 0) {
        out.push({
          key: 'national',
          title: t('stands.national'),
          hint: t('stands.nationalHint'),
          items: national,
        });
      }
    }
    if (filter === 'all') {
      for (const code of taggedStateCodes) {
        const items = forState(code);
        if (items.length === 0) continue;
        out.push({
          key: code,
          title: stateName(code, lang),
          hint: t('stands.stateHint'),
          items,
        });
      }
    } else if (filter !== 'national') {
      out.push({
        key: filter,
        title: stateName(filter, lang) || filter,
        hint: t('stands.stateHint'),
        items: forState(filter),
      });
    }
    return out;
  }, [filter, stands, standStates, taggedStateCodes, t, lang]);

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
      active ? 'bg-navy text-white border-navy' : 'bg-white text-sub border-line'
    }`;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 pb-8">
      <h1 className="font-display font-bold text-3xl text-navy">{t('nav.stands')}</h1>
      <p className="text-sub mt-2 max-w-xl">{t('stands.sub')}</p>

      {!loading && stands.length > 0 && (
        <div
          className="mt-6 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4"
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
          {taggedStateCodes.map((code) => (
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
        <p className="mt-10 text-sub">{t('stands.emptyFilter')}</p>
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

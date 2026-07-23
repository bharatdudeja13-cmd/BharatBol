import type { Stand } from './types';
import { STATES } from './states';

/**
 * Stands geography — the pure rules behind the Stands browse, extracted so
 * the semantics are directly testable (tests/stands-geography.test.ts).
 *
 * Correct semantics (Task 3):
 *   - "All India" (all)  → every stand: the national (untagged) ones AND
 *     every state-tagged stand, grouped by state. Nothing is hidden.
 *   - a specific state   → only that state's tagged stands. No All-India dump.
 *   - "national"         → only untagged (nationally-relevant) stands.
 * A stand is "state-tagged" when it has one or more entries in standStates;
 * a stand with no tags is national.
 */
export type GeoFilter = 'all' | 'national' | string;

export type StandSection = { key: string; items: Stand[] };

export function parseGeoParam(raw: string | null): GeoFilter {
  if (!raw || raw === 'all') return 'all';
  if (raw === 'national' || raw === 'all-india') return 'national';
  return raw;
}

export function standMatchesQuery(s: Stand, q: string): boolean {
  if (!q) return true;
  const hay = [s.title, s.title_hi, s.description, s.description_hi, s.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/** State codes (in tilegram order) that have at least one tagged stand. */
export function taggedStateCodes(standStates: Record<string, string[]>): string[] {
  const present = new Set<string>();
  for (const codes of Object.values(standStates)) {
    for (const c of codes) present.add(c);
  }
  return STATES.map((s) => s.code).filter((c) => present.has(c));
}

/**
 * The ordered sections to render for a given filter + query. Keys are
 * 'national' or a state code; the component supplies titles/hints.
 */
export function buildStandSections(
  stands: Stand[],
  standStates: Record<string, string[]>,
  filter: GeoFilter,
  query: string
): StandSection[] {
  const norm = query.trim().toLowerCase();
  const tagsFor = (id: string) => standStates[id] ?? [];
  const match = (s: Stand) => standMatchesQuery(s, norm);
  const national = stands.filter((s) => tagsFor(s.id).length === 0 && match(s));
  const forState = (code: string) =>
    stands.filter((s) => tagsFor(s.id).includes(code) && match(s));

  const out: StandSection[] = [];
  if (filter === 'all' || filter === 'national') {
    if (national.length > 0) out.push({ key: 'national', items: national });
  }
  if (filter === 'all') {
    for (const code of taggedStateCodes(standStates)) {
      const items = forState(code);
      if (items.length > 0) out.push({ key: code, items });
    }
  } else if (filter !== 'national') {
    out.push({ key: filter, items: forState(filter) });
  }
  return out;
}

/** Flat set of stand ids visible under a filter — for assertions and counts. */
export function visibleStandIds(
  stands: Stand[],
  standStates: Record<string, string[]>,
  filter: GeoFilter,
  query = ''
): Set<string> {
  const ids = new Set<string>();
  for (const sec of buildStandSections(stands, standStates, filter, query)) {
    for (const s of sec.items) ids.add(s.id);
  }
  return ids;
}

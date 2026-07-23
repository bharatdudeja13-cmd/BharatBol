/**
 * Task 3 gate: state-tagged stands must also appear under "All India",
 * a specific state shows only its own, and a different state does not
 * leak them in. Search keeps working across every filter.
 */
import { describe, it, expect } from 'vitest';
import type { Stand } from '../src/lib/types';
import {
  buildStandSections,
  visibleStandIds,
  parseGeoParam,
} from '../src/lib/standsGeography';

const mk = (id: string, over: Partial<Stand> = {}): Stand => ({
  id,
  title: `Stand ${id}`,
  title_hi: null,
  description: '',
  description_hi: null,
  category: 'education',
  status: 'live',
  created_at: '2026-01-01',
  ...over,
});

const NATIONAL = mk('nat', { title: 'A fixed timeline to fill vacant teaching posts' });
const MH = mk('mh', { title: 'Maharashtra exam centre audit' });
const TN = mk('tn', { title: 'Tamil Nadu transport fares' });

const stands = [NATIONAL, MH, TN];
const standStates: Record<string, string[]> = { mh: ['MH'], tn: ['TN'] };

describe('All India includes national AND every state-tagged stand', () => {
  it('shows all three stands under the "all" filter', () => {
    const ids = visibleStandIds(stands, standStates, 'all');
    expect(ids).toEqual(new Set(['nat', 'mh', 'tn']));
  });

  it('groups them: a national section plus one section per tagged state', () => {
    const secs = buildStandSections(stands, standStates, 'all', '');
    expect(secs.map((s) => s.key)).toEqual(['national', 'MH', 'TN']);
    expect(secs[1].items.map((s) => s.id)).toEqual(['mh']);
  });
});

describe('selecting a specific state shows only that state', () => {
  it('MH shows the MH-tagged stand and nothing else', () => {
    expect(visibleStandIds(stands, standStates, 'MH')).toEqual(new Set(['mh']));
  });

  it('a different state (TN) does not include the MH stand', () => {
    const tn = visibleStandIds(stands, standStates, 'TN');
    expect(tn.has('mh')).toBe(false);
    expect(tn).toEqual(new Set(['tn']));
  });

  it('a specific state never dumps national or every stand', () => {
    const mh = visibleStandIds(stands, standStates, 'MH');
    expect(mh.has('nat')).toBe(false);
    expect(mh.has('tn')).toBe(false);
  });
});

describe('national filter shows only untagged stands', () => {
  it('excludes state-tagged stands', () => {
    expect(visibleStandIds(stands, standStates, 'national')).toEqual(new Set(['nat']));
  });
});

describe('search works across filters', () => {
  it('filters within All India by query', () => {
    expect(visibleStandIds(stands, standStates, 'all', 'maharashtra')).toEqual(new Set(['mh']));
  });

  it('filters within a state view by query (no match → empty)', () => {
    expect(visibleStandIds(stands, standStates, 'MH', 'transport').size).toBe(0);
    expect(visibleStandIds(stands, standStates, 'TN', 'transport')).toEqual(new Set(['tn']));
  });
});

describe('parseGeoParam maps URL params to filters', () => {
  it.each([
    [null, 'all'],
    ['all', 'all'],
    ['national', 'national'],
    ['all-india', 'national'],
    ['MH', 'MH'],
  ])('%s → %s', (raw, expected) => {
    expect(parseGeoParam(raw as string | null)).toBe(expected);
  });
});

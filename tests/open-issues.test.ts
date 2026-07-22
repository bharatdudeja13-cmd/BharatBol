import { describe, it, expect } from 'vitest';
import { istDateKey, isIstToday } from '../src/lib/istDay';
import { deriveOpenIssues, topIssueStates } from '../src/lib/openIssues';
import type { Stand } from '../src/lib/types';

const stand = (over: Partial<Stand> & Pick<Stand, 'id'>): Stand => ({
  id: over.id,
  title: over.title ?? 'T',
  title_hi: null,
  description: 'd',
  description_hi: null,
  category: 'education',
  status: 'live',
  created_at: over.created_at ?? '2020-01-01T00:00:00.000Z',
  ...over,
});

describe('istDay', () => {
  it('formats a stable YYYY-MM-DD key in IST', () => {
    expect(istDateKey('2026-07-22T20:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('treats current instant as today', () => {
    expect(isIstToday(new Date().toISOString())).toBe(true);
  });

  it('rejects old timestamps', () => {
    expect(isIstToday('2020-01-01T00:00:00.000Z')).toBe(false);
  });
});

describe('deriveOpenIssues', () => {
  it('splits national vs tagged and builds issuesByState', () => {
    const stands = [
      stand({ id: 'n1' }),
      stand({ id: 'n2' }),
      stand({ id: 'd1' }),
      stand({ id: 'm1' }),
    ];
    const tags = {
      d1: ['DL'],
      m1: ['MH', 'DL'],
    };
    const m = deriveOpenIssues(stands, tags);
    expect(m.openNational).toBe(2);
    expect(m.openStateTagged).toBe(2);
    expect(m.issuesByState.DL).toBe(2);
    expect(m.issuesByState.MH).toBe(1);
  });

  it('lists stands added today in IST', () => {
    const stands = [
      stand({ id: 'old', created_at: '2020-01-01T00:00:00.000Z' }),
      stand({ id: 'new', created_at: new Date().toISOString() }),
    ];
    const m = deriveOpenIssues(stands, {});
    expect(m.addedToday.map((s) => s.id)).toEqual(['new']);
  });

  it('ranks top states by issue count', () => {
    expect(topIssueStates({ DL: 3, MH: 5, KA: 5 }, 2)).toEqual([
      { code: 'KA', count: 5 },
      { code: 'MH', count: 5 },
    ]);
  });
});

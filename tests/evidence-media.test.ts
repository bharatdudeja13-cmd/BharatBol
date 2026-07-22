import { describe, it, expect } from 'vitest';
import {
  evidencePosterCandidates,
  instagramProxyPoster,
  instagramShortcode,
} from '../src/lib/evidenceMedia';
import { detectBrowserLang, isLangCode, LANG_OPTIONS } from '../src/config/languages';
import { evidenceMatchesState, evidenceScopeOf } from '../src/state/useEvidence';
import { DEMO_FEED } from '../src/lib/demoFeed';
import type { FeedItem } from '../src/lib/types';

const base = (over: Partial<FeedItem>): FeedItem => ({
  id: '1',
  url: 'https://www.instagram.com/reel/CxYzAb12345/',
  platform: 'instagram',
  title: 'Clip',
  author_name: null,
  thumbnail_url: null,
  issue: 'education',
  state: 'DL',
  scope: 'state',
  status: 'approved',
  submitted_on: '2026-01-01',
  approved_at: '2026-01-01',
  ...over,
});

describe('evidence posters', () => {
  it('extracts Instagram shortcodes from reel URLs', () => {
    expect(instagramShortcode('https://www.instagram.com/reel/CxYzAb12345/')).toBe('CxYzAb12345');
  });

  it('prefers same-origin proxy before direct Instagram media', () => {
    const c = evidencePosterCandidates(base({}));
    expect(c[0]).toBe(instagramProxyPoster('CxYzAb12345'));
    expect(c.some((u) => u.includes('instagram.com/p/CxYzAb12345/media'))).toBe(true);
  });

  it('uses YouTube hqdefault when no thumbnail', () => {
    const c = evidencePosterCandidates(
      base({
        platform: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: null,
      })
    );
    expect(c[0]).toContain('i.ytimg.com/vi/dQw4w9WgXcQ');
  });

  it('prefers YouTube CDN over a broken stored thumbnail', () => {
    const c = evidencePosterCandidates(
      base({
        platform: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: 'https://example.com/broken.jpg',
      })
    );
    expect(c[0]).toContain('i.ytimg.com');
  });
});

describe('evidence state geography', () => {
  it('treats null state without scope as national', () => {
    expect(evidenceScopeOf({ state: null })).toBe('national');
    expect(evidenceScopeOf({ state: 'DL' })).toBe('state');
    expect(evidenceScopeOf({ state: 'DL', scope: 'national' })).toBe('national');
  });

  it('shows Delhi clips only for Delhi; national on every state', () => {
    const delhi = base({ state: 'DL', scope: 'state' });
    const national = base({ id: 'n', state: null, scope: 'national' });
    const mh = base({ id: 'mh', state: 'MH', scope: 'state' });

    expect(evidenceMatchesState(delhi, 'DL')).toBe(true);
    expect(evidenceMatchesState(delhi, 'MH')).toBe(false);
    expect(evidenceMatchesState(delhi, 'RJ')).toBe(false);
    expect(evidenceMatchesState(national, 'DL')).toBe(true);
    expect(evidenceMatchesState(national, 'MH')).toBe(true);
    expect(evidenceMatchesState(national, null)).toBe(true);
    expect(evidenceMatchesState(mh, 'DL')).toBe(false);
    expect(evidenceMatchesState(mh, 'MH')).toBe(true);
  });

  it('demo feed never leaks Delhi into other state tiles', () => {
    const forState = (code: string) => DEMO_FEED.filter((i) => evidenceMatchesState(i, code));

    const mh = forState('MH');
    expect(mh.every((i) => i.scope === 'national' || i.state === 'MH')).toBe(true);
    expect(mh.some((i) => i.state === 'DL' && i.scope === 'state')).toBe(false);

    const dl = forState('DL');
    expect(dl.some((i) => i.state === 'DL')).toBe(true);
    expect(dl.every((i) => i.scope === 'national' || i.state === 'DL')).toBe(true);

    const rj = forState('RJ');
    expect(rj.every((i) => i.scope === 'national' || i.state === 'RJ')).toBe(true);
    expect(rj.some((i) => i.state === 'DL')).toBe(false);
    // RJ has no local clips — only national may appear (never backfill with Delhi).
    expect(rj.every((i) => i.scope === 'national')).toBe(true);
  });
});

describe('languages', () => {
  it('lists English + 22 scheduled languages', () => {
    expect(LANG_OPTIONS.length).toBe(23);
    expect(isLangCode('hi')).toBe(true);
    expect(isLangCode('xx')).toBe(false);
  });

  it('detects browser language from navigator tags', () => {
    expect(detectBrowserLang(['bn-IN', 'en-US'])).toBe('bn');
    expect(detectBrowserLang(['ta'])).toBe('ta');
    expect(detectBrowserLang(['fr-FR'])).toBe('en');
  });
});

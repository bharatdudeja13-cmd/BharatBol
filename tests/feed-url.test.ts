/**
 * Canonicalization is the dedup key: two people sharing the same post
 * through different apps must collapse to one feed item, and unsupported
 * or hostile URLs must be rejected before they reach the queue.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSocialUrl, findSocialUrl, strippedShareDetails } from '../src/lib/feedUrl';

describe('canonicalization collapses duplicates', () => {
  it('all YouTube forms of one video canonicalize identically', () => {
    const forms = [
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://youtu.be/aqz-KE-bpKQ',
      'https://youtu.be/aqz-KE-bpKQ?si=trackingtoken',
      'https://m.youtube.com/watch?v=aqz-KE-bpKQ&feature=share',
      'https://www.youtube.com/shorts/aqz-KE-bpKQ',
      'https://www.youtube.com/embed/aqz-KE-bpKQ',
    ];
    const canons = new Set(forms.map((f) => parseSocialUrl(f)?.canon));
    expect(canons.size).toBe(1);
    expect([...canons][0]).toBe('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  });

  it('x.com and twitter.com forms of one post canonicalize identically', () => {
    const forms = [
      'https://x.com/Example/status/1700000000000000000',
      'https://twitter.com/example/status/1700000000000000000',
      'https://mobile.twitter.com/EXAMPLE/status/1700000000000000000?s=20&t=abc',
    ];
    const canons = new Set(forms.map((f) => parseSocialUrl(f)?.canon));
    expect(canons.size).toBe(1);
    expect([...canons][0]).toBe('https://x.com/example/status/1700000000000000000');
  });

  it('instagram reel and reels forms collapse; posts stay distinct', () => {
    expect(parseSocialUrl('https://www.instagram.com/reel/AbC123/')?.canon).toBe(
      parseSocialUrl('https://instagram.com/reels/AbC123/?igsh=xyz')?.canon
    );
    expect(parseSocialUrl('https://www.instagram.com/p/AbC123/')?.canon).not.toBe(
      parseSocialUrl('https://www.instagram.com/reel/AbC123/')?.canon
    );
  });

  it('personal share tags are dropped from the stored canon', () => {
    const dirty =
      'https://www.instagram.com/reel/DbFPTekxTVb/?igsh=MW94ZGozamQxOGN0ag==';
    const parsed = parseSocialUrl(dirty);
    expect(parsed?.canon).toBe('https://www.instagram.com/reel/DbFPTekxTVb/');
    expect(parsed?.canon).not.toMatch(/igsh/);
    expect(strippedShareDetails(dirty, parsed!.canon)).toBe(true);
  });
});

describe('unsupported and hostile input is rejected', () => {
  it.each([
    'not a url',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://evil.example.com/watch?v=abc',
    'https://youtube.com/@channel',
    'https://x.com/someone',
    'https://www.instagram.com/someone/',
    'https://youtube.com.evil.example/watch?v=abc',
  ])('rejects %s', (bad) => {
    expect(parseSocialUrl(bad)).toBeNull();
  });
});

describe('extraction from shared text', () => {
  it('pulls a supported link out of a share-sheet blob', () => {
    const shared = 'Look at this thread https://x.com/example/status/1700000000000000000 — important';
    expect(findSocialUrl(shared)?.platform).toBe('x');
  });

  it('returns null when the text has no supported link', () => {
    expect(findSocialUrl('check https://example.com/blog/post')).toBeNull();
  });
});

describe('client and Edge Function share one implementation', () => {
  it('parseSocialUrl is identical in the client and the Edge Function copy', () => {
    const root = join(__dirname, '..');
    // Compare just the parser: everything the dedup key depends on.
    const parserOf = (file: string) => {
      const src = readFileSync(join(root, file), 'utf8');
      const start = src.indexOf('export function parseSocialUrl');
      const end = src.indexOf('\n}\n', start);
      if (start < 0 || end < 0) throw new Error(`parseSocialUrl not found in ${file}`);
      return src
        .slice(start, end)
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    expect(parserOf('supabase/functions/_shared/feedUrl.ts')).toBe(parserOf('src/lib/feedUrl.ts'));
  });

  it('the TRACKING param list is identical in both copies', () => {
    const root = join(__dirname, '..');
    const listOf = (file: string) =>
      readFileSync(join(root, file), 'utf8')
        .match(/const TRACKING = \[([\s\S]*?)\];/)?.[1]
        .replace(/\s+/g, ' ')
        .trim();
    expect(listOf('supabase/functions/_shared/feedUrl.ts')).toBe(listOf('src/lib/feedUrl.ts'));
  });
});

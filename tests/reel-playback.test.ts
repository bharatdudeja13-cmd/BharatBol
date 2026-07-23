/**
 * Regression gate for "reels don't play on tap".
 *
 * The bug (fixed on develop by the Feed-as-explore reel-playback work that
 * landed via PR #15) was a frozen poster with no video. The load-bearing
 * conditions for muted inline autoplay are asserted here so a future edit
 * to the player cannot silently reintroduce it:
 *   - the embed must be muted AND playsinline (mobile autoplay policy),
 *   - autoplay must be requested,
 *   - the JS API must be enabled (so the unmute control works),
 *   - Instagram must NOT get an inline player (locked: poster + open original).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { youtubeReelEmbedSrc, youtubeIdFromUrl } from '../src/lib/evidenceMedia';

describe('youtubeReelEmbedSrc — muted inline autoplay params', () => {
  const src = youtubeReelEmbedSrc('jNQXAC9IVRw');
  const q = new URL(src).searchParams;

  it('uses the privacy-enhanced host and the right video id', () => {
    expect(src.startsWith('https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?')).toBe(true);
  });

  it.each([
    ['mute', '1'],
    ['playsinline', '1'],
    ['autoplay', '1'],
    ['enablejsapi', '1'],
  ])('sets %s=%s (required for tap-to-play)', (k, v) => {
    expect(q.get(k)).toBe(v);
  });
});

describe('youtubeIdFromUrl — the tap target resolves to a playable id', () => {
  it.each([
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://youtu.be/jNQXAC9IVRw',
    'https://www.youtube.com/shorts/jNQXAC9IVRw',
  ])('extracts the id from %s', (url) => {
    expect(youtubeIdFromUrl(url)).toBe('jNQXAC9IVRw');
  });
});

describe('the Feed player wires the tested builder and gates by active slide', () => {
  const feed = readFileSync(join(__dirname, '../src/pages/Feed.tsx'), 'utf8');

  it('builds the iframe src via youtubeReelEmbedSrc (not an inline string)', () => {
    expect(feed).toMatch(/src=\{youtubeReelEmbedSrc\(yid\)\}/);
    expect(feed).not.toMatch(/youtube-nocookie\.com\/embed\/\$\{/);
  });

  it('mounts the iframe only for the active YouTube slide', () => {
    expect(feed).toMatch(/isActive && yid &&/);
  });

  it('keeps Instagram poster-only (no inline iframe for instagram)', () => {
    // The only iframe in the player is the YouTube one.
    const iframeCount = (feed.match(/<iframe/g) ?? []).length;
    expect(iframeCount).toBe(1);
  });
});

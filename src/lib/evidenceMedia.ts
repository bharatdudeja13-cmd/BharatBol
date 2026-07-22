import type { FeedItem } from '../lib/types';

function ytId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

/** Best-effort poster for strip / player. Instagram often has none without oEmbed token. */
export function evidencePoster(item: FeedItem): string | null {
  if (item.thumbnail_url) return item.thumbnail_url;
  if (item.platform === 'youtube') {
    const y = ytId(item.url);
    return y ? `https://i.ytimg.com/vi/${y}/hqdefault.jpg` : null;
  }
  return null;
}

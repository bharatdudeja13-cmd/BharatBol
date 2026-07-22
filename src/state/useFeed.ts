import { useCallback, useEffect, useState } from 'react';
import { supabase, isLive, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import type { FeedItem } from '../lib/types';
import { DEMO_FEED } from '../lib/demoFeed';

/** Approved items only — the RLS policy enforces this server-side too. */
export function useFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) {
      setItems(DEMO_FEED);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('feed_items')
      .select('id,url,platform,title,author_name,thumbnail_url,issue,state,status,submitted_on,approved_at')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(200);
    setItems((data as FeedItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, reload: load };
}

export async function callFeedFn(
  name: 'feed-submit' | 'feed-moderate' | 'feed-report',
  body: unknown,
  accessToken?: string
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken ?? SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

export const feedLive = isLive;

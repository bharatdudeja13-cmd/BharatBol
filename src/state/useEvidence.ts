import { useCallback, useEffect, useState } from 'react';
import { supabase, isLive, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import type { FeedItem } from '../lib/types';
import { DEMO_FEED } from '../lib/demoFeed';

export type ReactionCounts = { ups: number; downs: number };

export type EvidenceFilters = {
  issue?: string | null;
  state?: string | null;
  limit?: number;
  /** When false, skip the network round-trip and return []. */
  enabled?: boolean;
};

/** Approved feed items = public evidence. */
export async function loadEvidence(filters: EvidenceFilters = {}): Promise<FeedItem[]> {
  if (filters.enabled === false) return [];
  if (!supabase) {
    return DEMO_FEED.filter((i) => {
      if (filters.issue && i.issue !== filters.issue) return false;
      if (filters.state && i.state !== filters.state) return false;
      return true;
    });
  }
  let q = supabase
    .from('feed_items')
    .select('id,url,platform,title,author_name,thumbnail_url,issue,state,status,submitted_on,approved_at')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(filters.limit ?? 40);
  if (filters.issue) q = q.eq('issue', filters.issue);
  if (filters.state) q = q.eq('state', filters.state);
  const { data } = await q;
  return (data as FeedItem[]) ?? [];
}

export async function loadReactionCounts(ids: string[]): Promise<Record<string, ReactionCounts>> {
  const out: Record<string, ReactionCounts> = {};
  if (ids.length === 0) return out;
  if (!supabase) {
    for (const id of ids) out[id] = { ups: 0, downs: 0 };
    return out;
  }
  const { data } = await supabase
    .from('feed_reaction_counts')
    .select('feed_item_id,ups,downs')
    .in('feed_item_id', ids);
  for (const row of data ?? []) {
    out[row.feed_item_id as string] = {
      ups: Number(row.ups) || 0,
      downs: Number(row.downs) || 0,
    };
  }
  for (const id of ids) if (!out[id]) out[id] = { ups: 0, downs: 0 };
  return out;
}

export function useEvidence(filters: EvidenceFilters) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [counts, setCounts] = useState<Record<string, ReactionCounts>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await loadEvidence(filters);
    setItems(list);
    setCounts(await loadReactionCounts(list.map((i) => i.id)));
    setLoading(false);
  }, [filters.issue, filters.state, filters.limit, filters.enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, counts, setCounts, loading, reload };
}

export async function callReactFn(
  name: 'react-issue' | 'react-cast' | 'react-withdraw',
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

export function evidenceWatchPath(opts: {
  issue?: string | null;
  state?: string | null;
  id?: string | null;
}): string {
  const p = new URLSearchParams();
  if (opts.issue) p.set('issue', opts.issue);
  if (opts.state) p.set('state', opts.state);
  if (opts.id) p.set('id', opts.id);
  const q = p.toString();
  return q ? `/evidence?${q}` : '/evidence';
}

export const evidenceLive = isLive;

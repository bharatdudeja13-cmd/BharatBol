import { useCallback, useEffect, useState } from 'react';
import { supabase, isLive } from '../lib/supabase';
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

function sortEvidenceForState(list: FeedItem[], stateCode: string | null | undefined): FeedItem[] {
  if (!stateCode) return list;
  return [...list].sort((a, b) => {
    const aLocal = a.state === stateCode ? 0 : 1;
    const bLocal = b.state === stateCode ? 0 : 1;
    if (aLocal !== bLocal) return aLocal - bLocal;
    const at = a.approved_at ?? '';
    const bt = b.approved_at ?? '';
    return bt.localeCompare(at);
  });
}

/** Approved feed items = public evidence. */
export async function loadEvidence(filters: EvidenceFilters = {}): Promise<FeedItem[]> {
  if (filters.enabled === false) return [];
  if (!supabase) {
    const list = DEMO_FEED.filter((i) => {
      if (filters.issue && i.issue !== filters.issue) return false;
      if (filters.state) {
        const scope = i.scope ?? (i.state ? 'state' : 'national');
        if (scope !== 'national' && i.state !== filters.state) return false;
      }
      return true;
    });
    return sortEvidenceForState(list, filters.state).slice(0, filters.limit ?? 40);
  }

  const select =
    'id,url,platform,title,author_name,thumbnail_url,issue,state,scope,status,submitted_on,approved_at';
  let q = supabase
    .from('feed_items')
    .select(select)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(Math.max((filters.limit ?? 40) * 2, 40));

  if (filters.issue) q = q.eq('issue', filters.issue);
  if (filters.state) {
    q = q.or(`state.eq.${filters.state},scope.eq.national`);
  }

  let { data, error } = await q;
  // Pre-phase7 DBs lack `scope` — fall back so public evidence still loads for everyone.
  if (error && /scope/i.test(error.message)) {
    let q2 = supabase
      .from('feed_items')
      .select(
        'id,url,platform,title,author_name,thumbnail_url,issue,state,status,submitted_on,approved_at'
      )
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(filters.limit ?? 40);
    if (filters.issue) q2 = q2.eq('issue', filters.issue);
    // Without scope: show all approved (incl. null state) when filtering by state,
    // so tiles never look empty while migration rolls out.
    const res2 = await q2;
    data = res2.data as typeof data;
    error = res2.error;
  }
  if (error) return [];
  let list = (data as FeedItem[] | null) ?? [];

  // Empty state filter: show recent approved clips so tiles never look broken.
  if (filters.state && list.length === 0) {
    const fb = await supabase
      .from('feed_items')
      .select(select)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(filters.limit ?? 40);
    if (!fb.error) list = (fb.data as FeedItem[] | null) ?? [];
  }

  return sortEvidenceForState(list, filters.state).slice(0, filters.limit ?? 40);
}

/** Fetch one approved item by id (ensures Watch deep-links open the right clip). */
export async function loadEvidenceById(id: string): Promise<FeedItem | null> {
  if (!id) return null;
  if (!supabase) return DEMO_FEED.find((i) => i.id === id) ?? null;
  const select =
    'id,url,platform,title,author_name,thumbnail_url,issue,state,scope,status,submitted_on,approved_at';
  const { data, error } = await supabase
    .from('feed_items')
    .select(select)
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle();
  if (error || !data) return null;
  return data as FeedItem;
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

export function evidenceWatchPath(opts: {
  issue?: string | null;
  state?: string | null;
  id?: string | null;
  stand?: string | null;
}): string {
  const p = new URLSearchParams();
  if (opts.issue) p.set('issue', opts.issue);
  if (opts.state) p.set('state', opts.state);
  if (opts.id) p.set('id', opts.id);
  if (opts.stand) p.set('stand', opts.stand);
  const q = p.toString();
  return q ? `/evidence?${q}` : '/evidence';
}

export const evidenceLive = isLive;

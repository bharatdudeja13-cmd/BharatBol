import { useCallback, useEffect, useState } from 'react';
import { isLive, supabase } from '../lib/supabase';

export type PublicStandLedger = {
  total: number;
  today: number;
};

/**
 * Anonymous public read of stand_counts for one stand.
 * Uses the security-definer aggregate view (granted to anon) - no login.
 */
export function usePublicStandLedger(standId: string | undefined) {
  const [record, setRecord] = useState<PublicStandLedger | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'demo'>('idle');

  const refresh = useCallback(async () => {
    if (!standId) return;
    if (!isLive || !supabase) {
      setStatus('demo');
      setRecord(null);
      return;
    }
    setStatus('loading');
    try {
      const { data, error } = await supabase
        .from('stand_counts')
        .select('total,today')
        .eq('stand_id', standId)
        .maybeSingle();
      if (error) throw error;
      setRecord({
        total: Number(data?.total ?? 0),
        today: Number(data?.today ?? 0),
      });
      setStatus('ready');
    } catch {
      setRecord(null);
      setStatus('error');
    }
  }, [standId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { record, status, refresh };
}

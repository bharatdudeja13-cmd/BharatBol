import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase, isLive } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import type { Stand, Counts, WallEntry, StateRow } from '../lib/types';
import {
  DEMO_STANDS,
  DEMO_COUNTS,
  DEMO_NATIONAL,
  DEMO_WALL,
  DEMO_BREAKDOWN,
} from '../lib/demo';

const PENDING_KEY = 'praja:pending-stand';

type StandsCtx = {
  stands: Stand[];
  counts: Record<string, Counts>;
  national: number;
  wall: WallEntry[];
  breakdown: StateRow[];
  joined: Set<string>;
  loading: boolean;
  /** Orchestrates the whole join flow (auth → profile → insert → share). */
  requestStand: (stand: Stand) => Promise<void>;
  withdraw: (standId: string) => Promise<void>;
  profileGate: Stand | null;
  resolveProfileGate: (proceed: boolean) => Promise<void>;
  shareFor: Stand | null;
  setShareFor: (s: Stand | null) => void;
};

const Ctx = createContext<StandsCtx | null>(null);

export function StandsProvider({ children }: { children: ReactNode }) {
  const { session, profile, ready, signIn } = useAuth();
  const [stands, setStands] = useState<Stand[]>([]);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [national, setNational] = useState(0);
  const [wall, setWall] = useState<WallEntry[]>([]);
  const [breakdown, setBreakdown] = useState<StateRow[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [profileGate, setProfileGate] = useState<Stand | null>(null);
  const [shareFor, setShareFor] = useState<Stand | null>(null);
  const seenJoinIds = useRef<Set<string>>(new Set());
  const nationalTimer = useRef<number | undefined>(undefined);

  // ---- Initial load ----
  useEffect(() => {
    if (!supabase) {
      setStands(DEMO_STANDS);
      setCounts(DEMO_COUNTS);
      setNational(DEMO_NATIONAL);
      setWall(DEMO_WALL);
      setBreakdown(DEMO_BREAKDOWN);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [standsRes, countsRes, wallRes, bdRes, natRes] = await Promise.all([
        supabase!.from('stands').select('*').eq('status', 'live').order('created_at'),
        supabase!.from('stand_counts').select('*'),
        supabase!.from('wall').select('*').order('created_at', { ascending: false }).limit(200),
        supabase!.from('state_breakdown').select('*'),
        supabase!.rpc('get_national_total'),
      ]);
      if (cancelled) return;
      setStands((standsRes.data as Stand[]) ?? []);
      const c: Record<string, Counts> = {};
      for (const row of countsRes.data ?? []) {
        c[row.stand_id] = { total: Number(row.total), today: Number(row.today) };
      }
      setCounts(c);
      setWall((wallRes.data as WallEntry[]) ?? []);
      setBreakdown(
        ((bdRes.data ?? []) as { stand_id: string; state: string; count: number }[]).map((r) => ({
          ...r,
          count: Number(r.count),
        }))
      );
      setNational(Number(natRes.data ?? 0));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- My joins ----
  useEffect(() => {
    if (!supabase || !session) {
      setJoined(new Set());
      return;
    }
    supabase
      .from('stand_joins')
      .select('stand_id')
      .then(({ data }) => setJoined(new Set((data ?? []).map((r) => r.stand_id as string))));
  }, [session]);

  const bump = useCallback((standId: string, state: string | null, delta: 1 | -1) => {
    setCounts((prev) => {
      const cur = prev[standId] ?? { total: 0, today: 0 };
      return {
        ...prev,
        [standId]: {
          total: Math.max(0, cur.total + delta),
          today: Math.max(0, cur.today + delta),
        },
      };
    });
    if (state) {
      setBreakdown((prev) => {
        const i = prev.findIndex((r) => r.stand_id === standId && r.state === state);
        if (i >= 0) {
          const next = prev.slice();
          next[i] = { ...next[i], count: Math.max(0, next[i].count + delta) };
          return next;
        }
        return delta > 0 ? [...prev, { stand_id: standId, state, count: 1 }] : prev;
      });
    }
  }, []);

  const refreshNationalSoon = useCallback(() => {
    if (!supabase) return;
    window.clearTimeout(nationalTimer.current);
    nationalTimer.current = window.setTimeout(async () => {
      const { data } = await supabase!.rpc('get_national_total');
      if (typeof data === 'number' || typeof data === 'string') setNational(Number(data));
    }, 800);
  }, []);

  // ---- Realtime: every insert into wall_events bumps the world ----
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('praja-wall')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wall_events' },
        (payload) => {
          const row = payload.new as {
            join_id: string;
            stand_id: string;
            first_name: string | null;
            state: string | null;
            created_at: string;
          };
          if (seenJoinIds.current.has(row.join_id)) return; // our own optimistic insert
          bump(row.stand_id, row.state, 1);
          if (row.first_name) {
            setWall((prev) =>
              [
                {
                  stand_id: row.stand_id,
                  first_name: row.first_name!,
                  state: row.state,
                  created_at: row.created_at,
                },
                ...prev,
              ].slice(0, 300)
            );
          }
          refreshNationalSoon();
        }
      )
      .subscribe();
    return () => {
      supabase!.removeChannel(channel);
    };
  }, [bump, refreshNationalSoon]);

  // ---- Join flow ----
  const doJoin = useCallback(
    async (stand: Stand) => {
      if (!supabase || !session || !profile) return;
      const { data, error } = await supabase
        .from('stand_joins')
        .insert({ stand_id: stand.id, user_id: session.user.id, state: profile.state })
        .select('id')
        .single();
      if (error) {
        if (error.code === '23505') {
          // Already standing — the DB kept the count honest.
          setJoined((prev) => new Set(prev).add(stand.id));
          setShareFor(stand);
          return;
        }
        throw error;
      }
      if (data?.id) seenJoinIds.current.add(data.id as string);
      setJoined((prev) => new Set(prev).add(stand.id));
      bump(stand.id, profile.state, 1);
      setNational((n) => n + (joined.size === 0 ? 1 : 0));
      refreshNationalSoon();
      if (profile.show_on_wall && profile.first_name) {
        setWall((prev) => [
          {
            stand_id: stand.id,
            first_name: profile.first_name,
            state: profile.state,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      setShareFor(stand);
    },
    [session, profile, bump, joined, refreshNationalSoon]
  );

  const requestStand = useCallback(
    async (stand: Stand) => {
      if (joined.has(stand.id)) {
        setShareFor(stand);
        return;
      }
      if (!isLive) {
        // Demo mode: simulate the whole flow locally.
        setJoined((prev) => new Set(prev).add(stand.id));
        bump(stand.id, null, 1);
        setNational((n) => n + 1);
        setShareFor(stand);
        return;
      }
      if (!session) {
        localStorage.setItem(PENDING_KEY, stand.id);
        await signIn();
        return;
      }
      if (!profile?.state || !profile.first_name) {
        setProfileGate(stand);
        return;
      }
      await doJoin(stand);
    },
    [joined, session, profile, signIn, doJoin, bump]
  );

  // Resume a join that was interrupted by the OAuth redirect.
  useEffect(() => {
    if (!ready || !session || loading) return;
    const pending = localStorage.getItem(PENDING_KEY);
    if (!pending) return;
    const stand = stands.find((s) => s.id === pending);
    localStorage.removeItem(PENDING_KEY);
    if (stand && !joined.has(stand.id)) {
      if (!profile) return; // profile still loading; user can tap again
      void requestStand(stand);
    }
  }, [ready, session, loading, stands, profile, joined, requestStand]);

  const resolveProfileGate = useCallback(
    async (proceed: boolean) => {
      const stand = profileGate;
      setProfileGate(null);
      if (proceed && stand) await doJoin(stand);
    },
    [profileGate, doJoin]
  );

  const withdraw = useCallback(
    async (standId: string) => {
      if (!isLive) {
        setJoined((prev) => {
          const next = new Set(prev);
          next.delete(standId);
          return next;
        });
        bump(standId, null, -1);
        return;
      }
      if (!supabase || !session) return;
      const { error } = await supabase
        .from('stand_joins')
        .delete()
        .eq('stand_id', standId)
        .eq('user_id', session.user.id);
      if (error) throw error;
      setJoined((prev) => {
        const next = new Set(prev);
        next.delete(standId);
        return next;
      });
      bump(standId, profile?.state ?? null, -1);
      refreshNationalSoon();
    },
    [session, profile, bump, refreshNationalSoon]
  );

  const value = useMemo(
    () => ({
      stands,
      counts,
      national,
      wall,
      breakdown,
      joined,
      loading,
      requestStand,
      withdraw,
      profileGate,
      resolveProfileGate,
      shareFor,
      setShareFor,
    }),
    [
      stands,
      counts,
      national,
      wall,
      breakdown,
      joined,
      loading,
      requestStand,
      withdraw,
      profileGate,
      resolveProfileGate,
      shareFor,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStands(): StandsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStands must be used within StandsProvider');
  return ctx;
}

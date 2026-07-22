/**
 * StandsProvider — account-linked stands (temporary §1 override).
 *
 * One Google account → one commitment per stand, stored under user_id.
 * Public counts come from views / stand_pulse (no user_id on the wire).
 * Supporter wall remains a separate opt-in write.
 */
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
import type { Stand, Counts, WallEntry, StateRow, Profile } from '../lib/types';
import {
  DEMO_STANDS,
  DEMO_COUNTS,
  DEMO_NATIONAL,
  DEMO_WALL,
  DEMO_BREAKDOWN,
} from '../lib/demo';

const PENDING_KEY = 'bharatbol:pending-stand';

type StandsCtx = {
  stands: Stand[];
  counts: Record<string, Counts>;
  national: number;
  wall: WallEntry[];
  breakdown: StateRow[];
  /** stand_id → state codes tagged “especially relevant in”. Empty = national only. */
  standStates: Record<string, string[]>;
  /** Featured stand pin, if any. */
  standOfTheDayId: string | null;
  joined: Set<string>;
  loading: boolean;
  requestStand: (stand: Stand) => Promise<void>;
  withdraw: (standId: string) => Promise<void>;
  withdrawAll: () => Promise<void>;
  syncWall: (profile: Profile) => Promise<void>;
  profileGate: Stand | null;
  resolveProfileGate: (proceed: boolean) => Promise<void>;
  shareFor: Stand | null;
  setShareFor: (s: Stand | null) => void;
  joinError: string | null;
  clearJoinError: () => void;
};

const Ctx = createContext<StandsCtx | null>(null);

export function StandsProvider({ children }: { children: ReactNode }) {
  const { session, profile, ready, signIn } = useAuth();
  const [stands, setStands] = useState<Stand[]>([]);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [national, setNational] = useState(0);
  const [wall, setWall] = useState<WallEntry[]>([]);
  const [breakdown, setBreakdown] = useState<StateRow[]>([]);
  const [standStates, setStandStates] = useState<Record<string, string[]>>({});
  const [standOfTheDayId, setStandOfTheDayId] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [profileGate, setProfileGate] = useState<Stand | null>(null);
  const [shareFor, setShareFor] = useState<Stand | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const ownPulseSkip = useRef(0);
  const ownWallEntryIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!supabase) {
      setStands(DEMO_STANDS);
      setCounts(DEMO_COUNTS);
      setNational(DEMO_NATIONAL);
      setWall(DEMO_WALL);
      setBreakdown(DEMO_BREAKDOWN);
      setStandStates({ [DEMO_STANDS[0].id]: ['MH', 'DL'] });
      setStandOfTheDayId(DEMO_STANDS[0].id);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [standsRes, countsRes, wallRes, bdRes, natRes, ssRes, sotdRes] = await Promise.all([
        supabase!.from('stands').select('*').eq('status', 'live').order('created_at'),
        supabase!.from('stand_counts').select('*'),
        supabase!.from('wall').select('*').order('created_at', { ascending: false }).limit(200),
        supabase!.from('state_breakdown').select('*'),
        supabase!.rpc('get_national_total'),
        supabase!.from('stand_states').select('stand_id,state'),
        supabase!.from('stand_of_the_day').select('stand_id').maybeSingle(),
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
      const ss: Record<string, string[]> = {};
      for (const row of ssRes.data ?? []) {
        const id = row.stand_id as string;
        const st = row.state as string;
        if (!ss[id]) ss[id] = [];
        ss[id].push(st);
      }
      setStandStates(ss);
      setStandOfTheDayId((sotdRes.data?.stand_id as string) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load this account's commitments when signed in.
  useEffect(() => {
    if (!supabase || !session) {
      setJoined(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase!
        .from('stand_commitments')
        .select('stand_id')
        .eq('user_id', session.user.id);
      if (cancelled) return;
      setJoined(new Set((data ?? []).map((r) => r.stand_id as string)));
    })();
    return () => {
      cancelled = true;
    };
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
    setNational((n) => Math.max(0, n + delta));
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

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('bharatbol-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stand_pulse' },
        (payload) => {
          if (ownPulseSkip.current > 0) {
            ownPulseSkip.current -= 1;
            return;
          }
          const row = payload.new as { stand_id: string; state: string | null; delta: number };
          bump(row.stand_id, row.state, row.delta > 0 ? 1 : -1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wall_feed' },
        (payload) => {
          const row = payload.new as {
            entry_id: number;
            stand_id: string;
            first_name: string;
            state: string | null;
            created_at: string;
          };
          if (ownWallEntryIds.current.has(row.entry_id)) return;
          setWall((prev) =>
            [
              {
                stand_id: row.stand_id,
                first_name: row.first_name,
                state: row.state,
                created_at: row.created_at,
              },
              ...prev,
            ].slice(0, 300)
          );
        }
      )
      .subscribe();
    return () => {
      void supabase!.removeChannel(channel);
    };
  }, [bump]);

  const doJoin = useCallback(
    async (stand: Stand) => {
      if (!supabase || !session || !profile) return;
      ownPulseSkip.current += 1;
      const { error } = await supabase.from('stand_commitments').insert({
        user_id: session.user.id,
        stand_id: stand.id,
        state: profile.state,
      });
      if (error) {
        ownPulseSkip.current = Math.max(0, ownPulseSkip.current - 1);
        if (error.code === '23505') {
          setJoined((prev) => new Set(prev).add(stand.id));
          setShareFor(stand);
          return;
        }
        setJoinError('failed');
        return;
      }
      setJoined((prev) => new Set(prev).add(stand.id));
      bump(stand.id, profile.state, 1);

      if (profile.show_on_wall && profile.first_name) {
        const ins = await supabase
          .from('wall_entries')
          .upsert(
            {
              user_id: session.user.id,
              stand_id: stand.id,
              first_name: profile.first_name,
              state: profile.state,
            },
            { onConflict: 'user_id,stand_id' }
          )
          .select('id')
          .single();
        if (ins.data?.id) ownWallEntryIds.current.add(ins.data.id as number);
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
    [session, profile, bump]
  );

  const requestStand = useCallback(
    async (stand: Stand) => {
      setJoinError(null);
      if (joined.has(stand.id)) {
        setShareFor(stand);
        return;
      }
      if (!isLive) {
        setJoined((prev) => new Set(prev).add(stand.id));
        bump(stand.id, null, 1);
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

  useEffect(() => {
    if (!ready || !session || loading || !profile) return;
    const pending = localStorage.getItem(PENDING_KEY);
    if (!pending) return;
    const stand = stands.find((s) => s.id === pending);
    localStorage.removeItem(PENDING_KEY);
    if (stand && !joined.has(stand.id)) void requestStand(stand);
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
      ownPulseSkip.current += 1;
      const { error } = await supabase
        .from('stand_commitments')
        .delete()
        .eq('stand_id', standId)
        .eq('user_id', session.user.id);
      if (error) {
        ownPulseSkip.current = Math.max(0, ownPulseSkip.current - 1);
        setJoinError('failed');
        return;
      }
      await supabase.from('wall_entries').delete().eq('stand_id', standId).eq('user_id', session.user.id);
      setJoined((prev) => {
        const next = new Set(prev);
        next.delete(standId);
        return next;
      });
      setWall((prev) => prev.filter((w) => !(w.stand_id === standId && w.first_name === profile?.first_name)));
      bump(standId, profile?.state ?? null, -1);
    },
    [session, bump, profile]
  );

  const withdrawAll = useCallback(async () => {
    if (!isLive || !supabase || !session) return;
    const ids = [...joined];
    for (const standId of ids) {
      await withdraw(standId);
    }
  }, [session, joined, withdraw]);

  const syncWall = useCallback(
    async (p: Profile) => {
      if (!supabase || !session || !p.show_on_wall || !p.first_name) return;
      for (const standId of joined) {
        const ins = await supabase
          .from('wall_entries')
          .upsert(
            { user_id: session.user.id, stand_id: standId, first_name: p.first_name, state: p.state },
            { onConflict: 'user_id,stand_id' }
          )
          .select('id')
          .single();
        if (ins.data?.id) ownWallEntryIds.current.add(ins.data.id as number);
      }
    },
    [session, joined]
  );

  const clearJoinError = useCallback(() => setJoinError(null), []);

  const value = useMemo(
    () => ({
      stands,
      counts,
      national,
      wall,
      breakdown,
      standStates,
      standOfTheDayId,
      joined,
      loading,
      requestStand,
      withdraw,
      withdrawAll,
      syncWall,
      profileGate,
      resolveProfileGate,
      shareFor,
      setShareFor,
      joinError,
      clearJoinError,
    }),
    [
      stands,
      counts,
      national,
      wall,
      breakdown,
      standStates,
      standOfTheDayId,
      joined,
      loading,
      requestStand,
      withdraw,
      withdrawAll,
      syncWall,
      profileGate,
      resolveProfileGate,
      shareFor,
      joinError,
      clearJoinError,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStands(): StandsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStands must be used within StandsProvider');
  return ctx;
}

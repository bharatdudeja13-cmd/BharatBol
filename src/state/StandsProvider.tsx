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
import { supabase, isLive, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import type { Stand, Counts, WallEntry, StateRow, Profile } from '../lib/types';
import { REGISTRAR_PUBLIC_JWK } from '../config/registrarKey';
import {
  blindForStand,
  finalizeReceipt,
  importRegistrarPublicKey,
  loadReceipts,
  saveReceipt,
  removeReceipt,
  type Receipt,
  type BlindingSession,
} from '../lib/blind';
import {
  DEMO_STANDS,
  DEMO_COUNTS,
  DEMO_NATIONAL,
  DEMO_WALL,
  DEMO_BREAKDOWN,
} from '../lib/demo';

const PENDING_KEY = 'bharatbol:pending-stand';
const CAST_KEY = 'bharatbol:cast:v1';

const loadCast = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CAST_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};
const persistCast = (ids: string[]) => localStorage.setItem(CAST_KEY, JSON.stringify(ids));

type StandsCtx = {
  stands: Stand[];
  counts: Record<string, Counts>;
  national: number;
  wall: WallEntry[];
  breakdown: StateRow[];
  joined: Set<string>;
  /** Stands whose tokens were issued to another device (import receipts to act here). */
  lockedElsewhere: Set<string>;
  loading: boolean;
  requestStand: (stand: Stand) => Promise<void>;
  withdraw: (standId: string) => Promise<void>;
  /** Best-effort withdrawal of every locally-known ballot (used before account erasure). */
  withdrawAll: () => Promise<void>;
  /** Re-create wall entries for locally-known stands after a wall opt-in. */
  syncWall: (profile: Profile) => Promise<void>;
  refreshReceipts: () => void;
  profileGate: Stand | null;
  resolveProfileGate: (proceed: boolean) => Promise<void>;
  shareFor: Stand | null;
  setShareFor: (s: Stand | null) => void;
  joinError: string | null;
  clearJoinError: () => void;
};

const Ctx = createContext<StandsCtx | null>(null);

const fnUrl = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

/**
 * Ballot calls carry ONLY the public anon key — never the user's JWT.
 * Using supabase.functions.invoke would attach the session token and
 * hand the ballot store the very identity link this design removes.
 */
async function anonFn(name: string, body: unknown): Promise<Response> {
  return fetch(fnUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

export function StandsProvider({ children }: { children: ReactNode }) {
  const { session, profile, ready, signIn } = useAuth();
  const [stands, setStands] = useState<Stand[]>([]);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [national, setNational] = useState(0);
  const [wall, setWall] = useState<WallEntry[]>([]);
  const [breakdown, setBreakdown] = useState<StateRow[]>([]);
  const [joined, setJoined] = useState<Set<string>>(() => new Set(isLive ? loadCast() : []));
  const [lockedElsewhere, setLockedElsewhere] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [profileGate, setProfileGate] = useState<Stand | null>(null);
  const [shareFor, setShareFor] = useState<Stand | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [receiptsVersion, setReceiptsVersion] = useState(0);
  const ownNullifiers = useRef<Set<string>>(new Set());
  const ownWallEntryIds = useRef<Set<number>>(new Set());
  const issuing = useRef(false);

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

  // ---- Realtime: anonymous ballots drive counts; wall_feed drives the wall ----
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('bharatbol-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ballots' },
        (payload) => {
          const row = payload.new as { stand_id: string; nullifier: string; state: string | null };
          if (ownNullifiers.current.has(row.nullifier)) return; // our optimistic bump
          bump(row.stand_id, row.state, 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ballots' },
        (payload) => {
          const row = payload.old as { stand_id?: string; nullifier?: string; state?: string | null };
          if (!row.stand_id) return; // needs replica identity full
          if (row.nullifier && ownNullifiers.current.has(row.nullifier)) return;
          bump(row.stand_id, row.state ?? null, -1);
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
      supabase!.removeChannel(channel);
    };
  }, [bump]);

  // ---- Token issuance: at sign-in, for ALL live stands (never at join time) ----
  useEffect(() => {
    if (!supabase || !session || loading || stands.length === 0 || !REGISTRAR_PUBLIC_JWK) return;
    if (issuing.current) return;
    const have = new Set(loadReceipts().map((r) => r.stand_id));
    const need = stands.filter((s) => !have.has(s.id));
    if (need.length === 0) return;
    issuing.current = true;
    (async () => {
      try {
        const publicKey = await importRegistrarPublicKey(REGISTRAR_PUBLIC_JWK);
        const sessions: BlindingSession[] = [];
        for (const s of need) sessions.push(await blindForStand(publicKey, s.id));
        const res = await fetch(fnUrl('registrar-issue'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            requests: sessions.map((s) => ({ stand_id: s.stand_id, blinded_b64: s.blinded_b64 })),
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          results: { stand_id: string; blind_sig_b64: string }[];
          refused: { stand_id: string; reason: string }[];
        };
        for (const r of data.results ?? []) {
          const sess = sessions.find((s) => s.stand_id === r.stand_id);
          if (!sess) continue;
          saveReceipt(await finalizeReceipt(publicKey, sess, r.blind_sig_b64));
        }
        const locked = (data.refused ?? [])
          .filter((r) => r.reason === 'already issued')
          .map((r) => r.stand_id);
        if (locked.length) setLockedElsewhere(new Set(locked));
        setReceiptsVersion((v) => v + 1);
      } finally {
        issuing.current = false;
      }
    })();
  }, [session, loading, stands, receiptsVersion]);

  // ---- Cast an anonymous ballot ----
  const doJoin = useCallback(
    async (stand: Stand) => {
      if (!supabase || !profile) return;
      const receipt = loadReceipts().find((r) => r.stand_id === stand.id);
      if (!receipt) {
        setJoinError(lockedElsewhere.has(stand.id) ? 'locked' : 'not-ready');
        return;
      }
      const res = await anonFn('ballot-cast', {
        stand_id: stand.id,
        token: receipt.token,
        sig_b64: receipt.sig_b64,
        state: profile.state,
      });
      if (res.status !== 200 && res.status !== 409) {
        setJoinError('failed');
        return;
      }
      ownNullifiers.current.add(receipt.nullifier);
      const nextCast = [...new Set([...loadCast(), stand.id])];
      persistCast(nextCast);
      setJoined(new Set(nextCast));
      if (res.status === 200) bump(stand.id, profile.state, 1);

      // The wall is voluntary publicity — a separate, consented, authed write.
      if (profile.show_on_wall && profile.first_name) {
        const ins = await supabase
          .from('wall_entries')
          .upsert(
            {
              user_id: session!.user.id,
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
    [session, profile, bump, lockedElsewhere]
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
      if (!REGISTRAR_PUBLIC_JWK) {
        setJoinError('no-key');
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

  // Resume a join interrupted by the OAuth redirect (after tokens arrive).
  useEffect(() => {
    if (!ready || !session || loading) return;
    const pending = localStorage.getItem(PENDING_KEY);
    if (!pending) return;
    const stand = stands.find((s) => s.id === pending);
    if (!stand) {
      localStorage.removeItem(PENDING_KEY);
      return;
    }
    if (!profile) return;
    const hasReceipt = loadReceipts().some((r) => r.stand_id === pending);
    if (!hasReceipt && !lockedElsewhere.has(pending)) return; // issuance still running
    localStorage.removeItem(PENDING_KEY);
    if (!joined.has(stand.id)) void requestStand(stand);
  }, [ready, session, loading, stands, profile, joined, requestStand, receiptsVersion, lockedElsewhere]);

  const resolveProfileGate = useCallback(
    async (proceed: boolean) => {
      const stand = profileGate;
      setProfileGate(null);
      if (proceed && stand) await doJoin(stand);
    },
    [profileGate, doJoin]
  );

  const withdrawOne = useCallback(
    async (standId: string): Promise<boolean> => {
      const receipt = loadReceipts().find((r) => r.stand_id === standId);
      if (!receipt) return false;
      const res = await anonFn('ballot-withdraw', {
        stand_id: standId,
        token: receipt.token,
        sig_b64: receipt.sig_b64,
      });
      if (!res.ok) return false;
      // The receipt stays valid for re-casting later; only the cast record clears.
      if (session) {
        await supabase!.from('wall_entries').delete().eq('stand_id', standId).eq('user_id', session.user.id);
      }
      return true;
    },
    [session]
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
      if (!(await withdrawOne(standId))) {
        setJoinError('failed');
        return;
      }
      const nextCast = loadCast().filter((id) => id !== standId);
      persistCast(nextCast);
      setJoined(new Set(nextCast));
      setWall((prev) => prev.filter((w) => !(w.stand_id === standId && w.first_name === profile?.first_name)));
      bump(standId, profile?.state ?? null, -1);
    },
    [withdrawOne, bump, profile]
  );

  const withdrawAll = useCallback(async () => {
    if (!isLive) return;
    for (const standId of loadCast()) {
      if (await withdrawOne(standId)) {
        bump(standId, profile?.state ?? null, -1);
      }
    }
    persistCast([]);
    setJoined(new Set());
  }, [withdrawOne, bump, profile]);

  const syncWall = useCallback(
    async (p: Profile) => {
      if (!supabase || !session || !p.show_on_wall || !p.first_name) return;
      for (const standId of loadCast()) {
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
    [session]
  );

  const refreshReceipts = useCallback(() => setReceiptsVersion((v) => v + 1), []);
  const clearJoinError = useCallback(() => setJoinError(null), []);

  const value = useMemo(
    () => ({
      stands,
      counts,
      national,
      wall,
      breakdown,
      joined,
      lockedElsewhere,
      loading,
      requestStand,
      withdraw,
      withdrawAll,
      syncWall,
      refreshReceipts,
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
      joined,
      lockedElsewhere,
      loading,
      requestStand,
      withdraw,
      withdrawAll,
      syncWall,
      refreshReceipts,
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

export type { Receipt };

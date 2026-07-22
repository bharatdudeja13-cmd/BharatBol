import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (patch: Partial<Omit<Profile, 'id'>>) => Promise<Profile | null>;
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  profile: null,
  ready: true,
  signIn: async () => {},
  signOut: async () => {},
  saveProfile: async () => null,
  deleteAccount: async () => {},
});

function guessFirstName(session: Session): string {
  const m = session.user.user_metadata ?? {};
  const raw = (m.given_name as string) || (m.full_name as string) || (m.name as string) || '';
  return raw.trim().split(/\s+/)[0] ?? '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Ensure a profile row exists for the signed-in user.
  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase!
        .from('profiles')
        .select('id, first_name, state, show_on_wall')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setProfile(data as Profile);
      } else {
        const fresh = {
          id: session.user.id,
          first_name: guessFirstName(session),
          state: null,
          show_on_wall: true,
        };
        await supabase!.from('profiles').insert(fresh);
        if (!cancelled) setProfile(fresh);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const saveProfile = useCallback(
    async (patch: Partial<Omit<Profile, 'id'>>) => {
      if (!supabase || !session) return null;
      const next: Profile = {
        id: session.user.id,
        first_name: patch.first_name ?? profile?.first_name ?? '',
        state: patch.state !== undefined ? patch.state : profile?.state ?? null,
        show_on_wall: patch.show_on_wall ?? profile?.show_on_wall ?? true,
      };
      const { error } = await supabase.from('profiles').upsert(next);
      if (error) throw error;
      setProfile(next);
      return next;
    },
    [session, profile]
  );

  const deleteAccount = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ session, profile, ready, signIn, signOut, saveProfile, deleteAccount }),
    [session, profile, ready, signIn, signOut, saveProfile, deleteAccount]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

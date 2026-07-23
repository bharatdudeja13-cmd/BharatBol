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
import { SITE_URL, supabase } from '../lib/supabase';
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

/** Strip OAuth code/state from the URL after PKCE exchange so refresh is clean. */
function cleanAuthParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let dirty = false;
  for (const k of ['code', 'state', 'error', 'error_description']) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k);
      dirty = true;
    }
  }
  if (url.hash.includes('access_token') || url.hash.includes('error')) {
    url.hash = '';
    dirty = true;
  }
  if (dirty) {
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    (async () => {
      // getSession reads storage AND completes URL code exchange when present.
      const { data, error } = await supabase!.auth.getSession();
      if (cancelled) return;
      if (error) console.warn('auth.getSession', error.message);
      setSession(data.session ?? null);
      if (data.session) cleanAuthParamsFromUrl();
      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (next) cleanAuthParamsFromUrl();
        setReady(true);
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

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
    // Prefer the origin the visitor is actually on. Vercel is the canonical host.
    // That origin must be listed under Supabase Auth → Redirect URLs.
    // Google Cloud Authorized redirect URI must stay:
    //   https://byfwdrazysblopnlahmx.supabase.co/auth/v1/callback
    // (never put the BharatBol URL in Google’s redirect list).
    // Consent "App name" = BharatBol is set in Google Cloud OAuth consent screen.
    const origin =
      typeof window !== 'undefined' ? window.location.origin : SITE_URL.replace(/\/$/, '');
    const path =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/';
    const redirectTo = `${origin}${path.startsWith('/') ? path : `/${path}`}`;
    try {
      sessionStorage.setItem('bharatbol:auth-return', redirectTo);
    } catch {
      /* ignore */
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          // Helps some browsers keep account chooser; does not change consent brand.
          prompt: 'select_account',
        },
      },
    });
    if (error) console.warn('signInWithOAuth', error.message);
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

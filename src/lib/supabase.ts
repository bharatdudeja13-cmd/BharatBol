import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_URL = url ?? '';
/** The anon key is public by design; ballot casts send ONLY this (never a user JWT). */
export const SUPABASE_ANON_KEY = anon ?? '';

/**
 * Persist session in localStorage; PKCE + detectSessionInUrl so Google
 * redirect `?code=` is exchanged on return. redirectTo must use the
 * visitor's current origin (see AuthProvider) and that origin must be
 * listed under Supabase Auth → Redirect URLs.
 */
export const supabase: SupabaseClient | null =
  url && anon
    ? createClient(url, anon, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
      })
    : null;

export const isLive = supabase !== null;

const isLocalHost =
  typeof window !== 'undefined' &&
  (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) ||
    window.location.hostname.endsWith('.local'));

/**
 * Demo mode is a LOCAL development convenience only. A deployed site
 * with missing/invalid Supabase config must fail visibly rather than
 * quietly serve sample data to real visitors as if it were real counts —
 * silently fake numbers would violate the honest-counts guardrail.
 */
export const configError: boolean = !isLive && import.meta.env.PROD && !isLocalHost;

/** Canonical public site URL (OG, docs). OAuth redirectTo uses window.location.origin. */
export const SITE_URL: string =
  (import.meta.env.VITE_SITE_URL as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://bharatbol.bharat-dudeja13.workers.dev');

export const REPO_URL: string =
  (import.meta.env.VITE_REPO_URL as string | undefined) || 'https://github.com/bharatdudeja13-cmd/BharatBol';

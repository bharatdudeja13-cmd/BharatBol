import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when env is not configured — the app then runs in local demo mode. */
export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export const isLive = supabase !== null;

export const SITE_URL: string =
  (import.meta.env.VITE_SITE_URL as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://praja.pages.dev');

export const REPO_URL: string =
  (import.meta.env.VITE_REPO_URL as string | undefined) || 'https://github.com/your-org/praja';

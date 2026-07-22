// Shared helpers for BharatBol Edge Functions (Deno runtime).
import { RSABSSA } from 'npm:@cloudflare/blindrsa-ts@0.4.4';
import { createClient } from 'npm:@supabase/supabase-js@2';

export const suite = () => RSABSSA.SHA384.PSS.Deterministic();

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null;
}

/** Service-role client — never exposed to the browser. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

export function ballotMessage(standId: string, tokenHex: string): Uint8Array {
  return new TextEncoder().encode(`bharatbol:ballot:v1:${standId}:${tokenHex}`);
}

/** Distinct domain from stand ballots — tokens are not interchangeable. */
export function reactMessage(feedItemId: string, tokenHex: string): Uint8Array {
  return new TextEncoder().encode(`bharatbol:feedreact:v1:${feedItemId}:${tokenHex}`);
}

export async function nullifierOf(standId: string, tokenHex: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', ballotMessage(standId, tokenHex));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function reactNullifierOf(feedItemId: string, tokenHex: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', reactMessage(feedItemId, tokenHex));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function importPrivateKey(): Promise<CryptoKey> {
  const jwk = JSON.parse(Deno.env.get('REGISTRAR_PRIVATE_JWK')!) as JsonWebKey;
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['sign']);
}

export async function importPublicKey(): Promise<CryptoKey> {
  const jwk = JSON.parse(Deno.env.get('REGISTRAR_PUBLIC_JWK')!) as JsonWebKey;
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['verify']);
}

export function b64ToBytes(s: string): Uint8Array {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TOKEN_RE = /^[0-9a-f]{64}$/;

/** Two-letter codes of the tilegram states — the only state values accepted. */
export const STATE_CODES = new Set([
  'JK','HP','PB','UK','HR','DL','RJ','UP','BR','SK','AR','GJ','MP','CG','JH',
  'WB','AS','ML','NL','MN','TR','MZ','MH','GA','TS','OD','KA','AP','TN','KL',
]);

/**
 * BharatBol blind-token client (RFC 9474 — RSABSSA-SHA384-PSS-Deterministic).
 *
 * The browser generates a random token per stand, blinds it, and has the
 * registrar sign it WITHOUT seeing it. The unblinded (token, signature)
 * pair — the "receipt" — is what later casts an anonymous ballot. The
 * registrar cannot correlate a receipt with any blinding it signed;
 * that is the cryptographic cut that keeps accounts and ballots apart.
 *
 * Receipts live only in this browser (localStorage). Losing them loses
 * the ability to withdraw or to see "you already stand" on this device —
 * never the dedup itself, which the ballot store enforces by nullifier.
 */
import { RSABSSA } from '@cloudflare/blindrsa-ts';

export const suite = () => RSABSSA.SHA384.PSS.Deterministic();

const te = new TextEncoder();

/** Domain-separated message a registrar signature covers. */
export function ballotMessage(standId: string, tokenHex: string): Uint8Array {
  return te.encode(`bharatbol:ballot:v1:${standId}:${tokenHex}`);
}

export function randomTokenHex(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

/** nullifier = sha256(message) — what the ballot store de-duplicates on. */
export async function nullifierOf(standId: string, tokenHex: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ballotMessage(standId, tokenHex));
  return bytesToHex(new Uint8Array(digest));
}

export type BlindingSession = {
  stand_id: string;
  token: string;
  blinded_b64: string;
  /** Blinding inverse — never leaves the client. */
  inv: Uint8Array;
};

export async function blindForStand(publicKey: CryptoKey, standId: string): Promise<BlindingSession> {
  const token = randomTokenHex();
  const { blindedMsg, inv } = await suite().blind(publicKey, ballotMessage(standId, token));
  return { stand_id: standId, token, blinded_b64: bytesToB64(blindedMsg), inv };
}

export type Receipt = {
  stand_id: string;
  token: string;
  sig_b64: string;
  nullifier: string;
};

/** Unblind the registrar's blind signature and verify it before trusting it. */
export async function finalizeReceipt(
  publicKey: CryptoKey,
  session: BlindingSession,
  blindSigB64: string
): Promise<Receipt> {
  const msg = ballotMessage(session.stand_id, session.token);
  const sig = await suite().finalize(publicKey, msg, b64ToBytes(blindSigB64), session.inv);
  const ok = await suite().verify(publicKey, sig, msg);
  if (!ok) throw new Error('registrar signature failed verification');
  return {
    stand_id: session.stand_id,
    token: session.token,
    sig_b64: bytesToB64(sig),
    nullifier: await nullifierOf(session.stand_id, session.token),
  };
}

export async function importRegistrarPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['verify']);
}

// ---- Receipt store (this device only) ----

const STORE_KEY = 'bharatbol:receipts:v1';

export function loadReceipts(): Receipt[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as Receipt[];
  } catch {
    return [];
  }
}

export function saveReceipt(r: Receipt): void {
  const all = loadReceipts().filter((x) => x.stand_id !== r.stand_id);
  all.push(r);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
}

export function removeReceipt(standId: string): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(loadReceipts().filter((x) => x.stand_id !== standId)));
}

/** Export/import lets a citizen carry receipts to another device. */
export function exportReceipts(): string {
  return JSON.stringify({ bharatbol_receipts: 1, receipts: loadReceipts() }, null, 2);
}

export function importReceipts(json: string): number {
  const parsed = JSON.parse(json) as { bharatbol_receipts?: number; receipts?: Receipt[] };
  if (parsed.bharatbol_receipts !== 1 || !Array.isArray(parsed.receipts)) {
    throw new Error('not a BharatBol receipts file');
  }
  for (const r of parsed.receipts) saveReceipt(r);
  return parsed.receipts.length;
}

// ---- Encoding helpers ----

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

export function b64ToBytes(s: string): Uint8Array {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

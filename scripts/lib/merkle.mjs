/**
 * RFC 6962 Merkle tree over BharatBol ballot-log events (SHA-256).
 * Shared verbatim by the node scripts and the browser UI (plain ESM +
 * WebCrypto only), so verifier and producer can never drift.
 *
 * Leaf encoding `bharatbol-log-leaf-v1`: the canonical JSON below —
 * fixed field order, no whitespace — hashed as sha256(0x00 || leaf);
 * interior nodes are sha256(0x01 || left || right). Trees split at the
 * largest power of two smaller than n (RFC 6962 §2.1); inclusion-proof
 * verification follows RFC 9162 §2.1.3.2.
 */

const te = new TextEncoder();

/** Fixed field order — the wire format checkpoints commit to.
 *  A caller may supply its own leaf encoding via `__canon` (used by the
 *  stand ledger, whose entries hash over scripts/lib/ledger.js strings). */
export function canonicalEvent(e) {
  if (typeof e.__canon === 'string') return e.__canon;
  return JSON.stringify({
    seq: Number(e.seq),
    event: e.event,
    stand_id: e.stand_id,
    nullifier: e.nullifier,
    state: e.state ?? null,
    event_on: e.event_on,
  });
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (s) => new Uint8Array(s.match(/../g)?.map((x) => parseInt(x, 16)) ?? []);

export async function leafHash(event) {
  return sha256(concat(Uint8Array.of(0), te.encode(canonicalEvent(event))));
}

async function nodeHash(left, right) {
  return sha256(concat(Uint8Array.of(1), left, right));
}

/** Largest power of two strictly smaller than n (n >= 2). */
function split(n) {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

async function mth(hashes, lo, hi) {
  const n = hi - lo;
  if (n === 0) return sha256(new Uint8Array(0));
  if (n === 1) return hashes[lo];
  const k = split(n);
  return nodeHash(await mth(hashes, lo, lo + k), await mth(hashes, lo + k, hi));
}

/** Merkle root (hex) over events[0..size). */
export async function merkleRoot(events, size = events.length) {
  const hashes = await Promise.all(events.slice(0, size).map(leafHash));
  return toHex(await mth(hashes, 0, size));
}

async function path(hashes, m, lo, hi) {
  const n = hi - lo;
  if (n <= 1) return [];
  const k = split(n);
  if (m < k) {
    return [...(await path(hashes, m, lo, lo + k)), await mth(hashes, lo + k, hi)];
  }
  return [...(await path(hashes, m - k, lo + k, hi)), await mth(hashes, lo, lo + k)];
}

/** Inclusion proof (audit path, hex[]) for events[index] in events[0..size). */
export async function inclusionProof(events, index, size = events.length) {
  if (index < 0 || index >= size) throw new Error('index out of range');
  const hashes = await Promise.all(events.slice(0, size).map(leafHash));
  return (await path(hashes, index, 0, size)).map(toHex);
}

/** RFC 9162 §2.1.3.2 verification: does `event` at `index` sit under `rootHex`? */
export async function verifyInclusion(event, index, size, proofHex, rootHex) {
  if (index < 0 || index >= size) return false;
  let fn = index;
  let sn = size - 1;
  let r = await leafHash(event);
  for (const pHex of proofHex) {
    if (sn === 0) return false;
    const p = fromHex(pHex);
    if (fn % 2 === 1 || fn === sn) {
      r = await nodeHash(p, r);
      if (fn % 2 === 0) {
        while (fn % 2 === 0 && fn !== 0) {
          fn = Math.floor(fn / 2);
          sn = Math.floor(sn / 2);
        }
      }
    } else {
      r = await nodeHash(r, p);
    }
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  return sn === 0 && toHex(r) === rootHex;
}

/** Replay the log: per-stand totals and national total (casts − withdraws). */
export function replayCounts(events) {
  const stands = new Map();
  for (const e of events) {
    const d = e.event === 'cast' ? 1 : -1;
    stands.set(e.stand_id, (stands.get(e.stand_id) ?? 0) + d);
  }
  let national = 0;
  for (const [id, c] of [...stands]) {
    if (c < 0) throw new Error(`negative count for stand ${id} — log is inconsistent`);
    national += c;
  }
  return { stands: Object.fromEntries([...stands].sort()), national };
}

/**
 * Public stand ledger — canonical encodings shared by the browser page,
 * the recount script, and the Rekor checkpoint signer, so none of them can
 * drift on what a "ledger entry" or a "checkpoint" hashes to.
 *
 * Source of truth is `stand_pulse`: anonymous per-event rows
 * (id, stand_id, delta ±1, at). NO user_id, ever. The ledger reads only
 * these fields — never `stand_commitments` (which is account-linked).
 *
 * Exact timestamps are shown by owner decision; the page discloses the
 * small de-anonymization risk on low-volume stands honestly.
 */

const te = new TextEncoder();

/** stood (+1) or withdrew (−1). */
export const eventOf = (delta) => (Number(delta) < 0 ? 'withdrew' : 'stood');

/**
 * Canonical string a ledger entry hashes over. Fixed field order, exact
 * ISO timestamp. Deliberately excludes state (identity-narrowing on
 * low-volume stands) and of course any account id.
 */
export function canonicalEntry(e) {
  return `bharatbol-ledger:v1:${Number(e.id)}:${e.stand_id}:${eventOf(e.delta)}:${e.at}`;
}

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Per-entry public hash — anyone can recompute it from the public row. */
export function entryHash(e) {
  return sha256Hex(te.encode(canonicalEntry(e)));
}

/**
 * The bytes a checkpoint signs / commits to. Binds the tree size and the
 * Merkle root so a signature over it certifies "the log of this many
 * entries hashes to this root".
 */
export function canonicalCheckpoint({ size, root }) {
  return `bharatbol-ledger-checkpoint:v1:${size}:${root}`;
}

export function checkpointDigestHex({ size, root }) {
  return sha256Hex(te.encode(canonicalCheckpoint({ size, root })));
}

/** Replay the log → per-stand totals + grand total (stood − withdrew). */
export function replayLedger(entries) {
  const stands = new Map();
  for (const e of entries) {
    const d = eventOf(e.delta) === 'stood' ? 1 : -1;
    stands.set(e.stand_id, (stands.get(e.stand_id) ?? 0) + d);
  }
  let total = 0;
  for (const [id, c] of stands) {
    if (c < 0) throw new Error(`negative count for stand ${id} — log inconsistent`);
    total += c;
  }
  return { stands: Object.fromEntries([...stands].sort()), total };
}

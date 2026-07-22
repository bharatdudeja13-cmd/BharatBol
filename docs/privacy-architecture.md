# BharatBol Phase 2 — the anonymous-token architecture (§1 design, for review)

**Status: DRAFT — awaiting approval before any UI wiring.**
Companion migration: [`supabase/phase2_privacy.sql`](../supabase/phase2_privacy.sql).

## The problem being fixed

Phase 1 stored `stand_joins(user_id, stand_id)`: one private table that, if dumped or seized,
maps every account to every stand it took. Phase 2 removes that stored linkage while keeping
strict one-per-account dedup and live counts.

## The design in one paragraph

When a citizen signs in, their browser generates one random token per live stand, **blinds**
each token (RFC 9474 RSA blind signatures), and asks the **registrar** to sign them. The
registrar — which checks "has this account been issued tokens before?" — signs the blinded
tokens for **every live stand in one batch**, so the record it keeps (`token_issuance`) says
only "this account was issued its tokens", never which issues the person cares about. The
browser unblinds the signatures and keeps the (token, signature) pairs locally. To stand on an
issue, the browser presents the token for that stand — over an **unauthenticated** request — to
the **ballot store**, which verifies the registrar's signature, hashes the token into a unique
**nullifier**, and appends an anonymous ballot: `stand_id, nullifier, state, date`. Blinding
guarantees the registrar cannot recognise the token it signed; the unique nullifier guarantees
each token spends exactly once.

## Why each promise holds

- **One per account per stand.** The registrar issues exactly one token per (account, stand) —
  `primary key (user_id, stand_id)` on `token_issuance`. The ballot store accepts each token
  exactly once — `unique` nullifier. A second join attempt has no unspent token to present.
- **The database cannot link an account to a ballot.** `ballots` has no `user_id` column and no
  FK to `auth.users`. `token_issuance` is uniform (everyone gets tokens for every stand at
  sign-in) and never sees the unblinded token. The blind signature is the cryptographic cut:
  what the registrar signed and what the ballot store receives are unlinkable values.
- **Counts stay live and honest.** Views aggregate `ballots`; realtime fires on ballot inserts.
  Withdrawal presents the same token receipt; the ballot row is deleted and counts drop.
- **Erasure (DPDP).** Account deletion cascades profile, issuance records, and wall entries.
  The app first auto-withdraws all ballots using the locally held receipts, so counts decrement.
  If receipts were lost, the leftover ballots are anonymous rows that nobody — including us —
  can tie to the deleted account.

## The wall is separate from counting

The supporter wall becomes **voluntary publicity, decoupled from the count**. Opting in writes
`wall_entries(user_id, stand_id, first_name, state)` — deliberately account-linked so the
citizen keeps retroactive control (rename, opt out, cascade on erasure), mirrored to a
`wall_feed` table with no `user_id` for public reads/realtime. The join-flow copy must say
plainly: *"showing your name links this stand to your account in our private database; skip it
to stay fully anonymous."* Counts never read from wall tables.

## Honest metric change (needs your sign-off)

Ballots for different stands are unlinkable **by design**, so "N distinct citizens across all
stands" is no longer computable by anyone. The national headline becomes **total stands taken**
(sum of ballots), relabelled accordingly (e.g. "stands taken by citizens across India").
Per-stand counts keep meaning "citizens standing" (dedup is per stand).

## Interfaces (Edge Functions, service role; to be built after approval)

| Function | Auth | Does |
| --- | --- | --- |
| `registrar-issue` | user JWT | For each live stand not yet in `token_issuance` for this account: record issuance, sign the blinded token. Returns blind signatures. Called at sign-in, **not** at join time. |
| `ballot-cast` | **none** (anon key only, no user JWT attached) | Verify RSA-PSS signature over `stand_id ‖ token` against the registrar public key; insert ballot with nullifier `sha256(token)`. |
| `ballot-withdraw` | none | Same verification; delete the ballot whose nullifier matches. |

Crypto: RFC 9474 RSA blind signatures via `@cloudflare/blindrsa-ts` (audited, browser + Deno).
Registrar private key lives in Edge Function secrets; the **public key is committed to the repo**
so anyone can verify that only registrar-issued tokens can enter the log. Client receipts
(token, signature, stand) live in `localStorage` under `bharatbol:receipts`.

## Residual risks — stated, not hidden

1. **Operator logs.** The DB stores no linkage, but Supabase platform request logs could
   correlate an authenticated `registrar-issue` call with a nearby anonymous `ballot-cast` by
   timing/IP. Mitigations now: issuance at sign-in (not at join), date-only ballot timestamps,
   unauthenticated cast requests. Real fix (roadmap): run registrar and ballot store under
   separate operators/infrastructure.
2. **Small anonymity sets.** A ballot's `state` on a low-traffic stand narrows candidates.
   Mitigation: date-coarse timestamps; roadmap: suppress state below a k-anonymity threshold.
3. **Client-held receipts.** Clearing browser data forfeits withdraw-ability and the
   "you already stand" indicator on other devices (the dedup itself still holds server-side).
4. **Wall opt-in is linkage by consent** — see above; stated in the UI at the moment of choice.

The About page will change from the Phase-1 trade-off caveat to: linkage is **prevented by
design in everything the database stores**, with these residual limits disclosed — wording
included in the review below.

## Migration

Nothing is deployed yet (no live Supabase project exists), so there is no data migration:
fresh installs run `schema.sql` then `phase2_privacy.sql`. The migration drops `stand_joins`
and `wall_events` and their views/triggers; `stands` seeds and `profiles` are untouched.

## Test plan (§1 acceptance)

- **Unit (vitest):** blind → sign → unblind → verify roundtrip; tampered token rejected;
  nullifier determinism; double-spend rejected by unique constraint (simulated store).
- **Schema assertions (vitest, static):** `ballots` and `wall_feed` contain no `user_id` and no
  FK to `auth.users`; `token_issuance` has zero RLS policies; no view or grant exposes
  `token_issuance` or `wall_entries.user_id` to `anon`.
- **Live checks (documented script, needs a real project):** second-join rejection end-to-end;
  erasure cascade (profiles/issuance/wall gone, counts decremented via auto-withdraw).

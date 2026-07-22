# Praja — Where India stands. <img src="public/icons/icon.svg" width="28" align="top" alt="">

**Praja** (प्रजा — “the people”) is a mobile-first, installable PWA: a strictly **non-partisan
national civic square** where any Indian citizen — whatever party they support, or none — can
publicly **stand** on an issue and be counted, verifiably and in the open.

> **The one promise: prove how many. Never show who.**

Praja is an independent, non-partisan civic platform. It is not affiliated with any government,
party, or election authority. Counts reflect public sentiment and **are not an election**.

---

## Features

- **Live national counter** — “N citizens standing”, with per-stand “+N today” momentum, updated
  in realtime for every visitor.
- **Stands** — neutral, issue-framed causes with live counts, state-wise breakdowns, and a
  supporter wall.
- **One-tap join** — Google sign-in, one stand per account (DB-enforced), revocable any time.
- **Supporter wall** — opt-in, first name + state only (“Aarti · Maharashtra”).
- **India tilegram** — 9×9 rounded-tile map shaded by standing intensity; tap a state for its counts.
- **Shareable proof card & citizen card** — rendered client-side on `<canvas>`, shared via the
  Web Share API or downloaded as PNG.
- **EN / हिंदी** scaffold, PWA install, reduced-motion support, visible focus states.
- **Demo mode** — with no Supabase env configured, the app runs on local sample data so anyone
  can audit the UI.

## Stack

Vite + React + TypeScript + Tailwind · Supabase (Postgres, Google Auth, Realtime, RLS) ·
Cloudflare Pages. Total hosting cost: ₹0.

## The trust-critical paths (read these first)

The whole product rests on a few small pieces. If you audit anything, audit these:

| Path | What it guarantees |
| --- | --- |
| [`supabase/phase2_privacy.sql`](supabase/phase2_privacy.sql) | The privacy model. Stands are recorded as **anonymous ballots**: the `ballots` table has no user column and no FK to `auth.users`; dedup comes from a unique nullifier, not identity. The registrar's `token_issuance` ledger (RLS, zero policies, zero grants) records only that an account was issued blind tokens **for every live stand at once** — it carries no preference signal. The wall is voluntary publicity, account-linked *by consent* so it stays editable and erasable. |
| [`docs/privacy-architecture.md`](docs/privacy-architecture.md) | The full design in plain language: RFC 9474 blind signatures, why each promise holds, and the residual risks stated honestly (platform log timing/IP correlation; two-operator split is the roadmap fix). |
| [`supabase/functions/`](supabase/functions/) | `registrar-issue` (authed; blind-signs; never touches ballots) · `ballot-cast` / `ballot-withdraw` (unauthenticated; verify the blind signature; nullifier dedup). Identity and ballots never meet in one process. |
| [`tests/unlinkability.test.ts`](tests/unlinkability.test.ts) | **The acceptance gate**: automated assertions that no query path yields account↔ballot, the registrar ledger is sealed, erasure cascades, and a simulated curious registrar fails to link receipts to accounts. Run with `npm test`. |
| [`src/lib/blind.ts`](src/lib/blind.ts) + [`src/state/StandsProvider.tsx`](src/state/StandsProvider.tsx) | Client protocol: blind → issue → finalize → cast **without a user JWT**. Receipts (the only proof of your own ballots) live in the browser, exportable/importable from the profile page. |
| [`src/lib/cards.ts`](src/lib/cards.ts) | Share cards are drawn entirely client-side; nothing is uploaded. |

**Honest limits** (also on the About page): the database stores no account↔stand link — that is
now enforced by schema and tests, and it is why the national headline counts *stands taken*
(distinct citizens across stands is uncomputable, by design). Infrastructure request logs could
in principle correlate by timing/IP; running registrar and ballot store under separate operators
is the real fix and is on the roadmap. Losing your browser's receipts means nobody — including
us — can withdraw or link your anonymous ballots.

## Guardrails (non-negotiable)

1. **Issue-framed, never person-framed.** No stand targets an individual, party, company, or community.
2. **Strictly non-partisan** — in copy, seed data, and moderation.
3. **Not an election.** The disclaimer is permanently visible in the footer of every page.
4. **Honest counts** — labelled “verified engaged citizens”, never a census.
5. **Measures sentiment, never instructs action.**

## Local development

```bash
npm install
npm run dev          # demo mode: sample data, no backend needed
```

## Going live

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run [`supabase/schema.sql`](supabase/schema.sql), then
   [`supabase/phase2_privacy.sql`](supabase/phase2_privacy.sql), once each, in that order.
3. Generate the registrar key pair and deploy the Edge Functions:
   ```bash
   node scripts/generate-registrar-key.mjs   # prints public + private JWK
   # paste the PUBLIC JWK into src/config/registrarKey.ts (commit it)
   supabase secrets set REGISTRAR_PRIVATE_JWK='<private jwk json>' \
                        REGISTRAR_PUBLIC_JWK='<public jwk json>'
   supabase functions deploy registrar-issue ballot-cast ballot-withdraw
   ```
4. **Authentication → Providers → Google**: enable it (create OAuth credentials in Google Cloud
   Console; authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`).
5. **Authentication → URL Configuration**: set Site URL to your Pages domain
   (e.g. `https://praja.pages.dev`) and add it to Redirect URLs (plus `http://localhost:5173`
   for development).

### 2. Environment

```bash
cp .env.example .env   # fill VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL, VITE_REPO_URL
```

### 3. Cloudflare Pages

- Create a Pages project from this repo. Build command `npm run build`, output directory `dist`,
  and add the four `VITE_*` environment variables.
- Or deploy directly: `npx wrangler pages deploy dist`.
- `public/_redirects` already routes all paths to the SPA. Cloudflare’s CDN absorbs read traffic;
  only writes and realtime touch Supabase — which is what keeps millions of viewers free.

### 4. Verify end-to-end

Sign in on the deployed site, stand on an issue, and confirm: the count bumps live in a second
browser, your name appears on the wall (if opted in), withdrawal decrements the count, and
account deletion (Profile → delete) erases everything.

## License

[MIT](LICENSE). Praja is open source so its promises can be verified, not merely believed.

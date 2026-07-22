# Deploying — operator guide

Operational setup for running a live instance. (Product story, trust-critical paths, and
guardrails live in the [README](../README.md); the privacy design is in
[privacy-architecture.md](privacy-architecture.md).)

## 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run [`supabase/schema.sql`](../supabase/schema.sql), then
   [`supabase/phase2_privacy.sql`](../supabase/phase2_privacy.sql), then
   [`supabase/phase2b_public_log.sql`](../supabase/phase2b_public_log.sql),
   [`supabase/phase3_polls.sql`](../supabase/phase3_polls.sql),
   [`supabase/phase4_feed.sql`](../supabase/phase4_feed.sql),
   [`supabase/phase5_feed_reactions.sql`](../supabase/phase5_feed_reactions.sql) and
   [`supabase/phase6_account_stands.sql`](../supabase/phase6_account_stands.sql) and
   [`supabase/phase7_geography.sql`](../supabase/phase7_geography.sql), once each, in that order.
   Phase7 also recreates **public** `stand_counts` / `state_breakdown` /
   `feed_reaction_counts` as security-definer aggregates (anon must see totals)
   and adds evidence `scope` + `stand_states` / stand-of-the-day.
3. Generate the registrar key pair and deploy Edge Functions (legacy blind path still
   deployable; the **live app** uses account-linked `stand_commitments` /
   `feed_item_reactions` via client RLS after phase6 — no ballot/react edge calls):
   ```bash
   node scripts/generate-registrar-key.mjs   # prints public + private JWK
   # paste the PUBLIC JWK into src/config/registrarKey.ts (commit it)
   supabase secrets set REGISTRAR_PRIVATE_JWK='<private jwk json>' \
                        REGISTRAR_PUBLIC_JWK='<public jwk json>'
   # Optional / legacy (not used by the current client while account-linked mode is on):
   # supabase functions deploy registrar-issue
   # supabase functions deploy ballot-cast ballot-withdraw --no-verify-jwt
   # supabase functions deploy react-issue
   # supabase functions deploy react-cast react-withdraw --no-verify-jwt
   supabase functions deploy feed-submit feed-moderate
   supabase functions deploy feed-report --no-verify-jwt
   ```
   `feed-report` is intentionally unauthenticated: original creators and affected
   people may have no account, and a takedown route that requires a login is not a
   real takedown route. `feed-submit` and `feed-moderate` both require a user JWT.

   Moderators are rows in the sealed `admins` table — add yourself once:
   ```sql
   insert into public.admins (user_id) values ('<your auth.users id>');
   ```
   Optional: `supabase secrets set INSTAGRAM_OEMBED_TOKEN='<facebook app token>'`
   to fetch Instagram thumbnails. Without it, Instagram items stay titled
   link-cards — BharatBol never scrapes.
   After phase6, stands and reactions are written under the signed-in account
   (temporary §1 override). Restore blind ballots later via
   [privacy-architecture.md](privacy-architecture.md).
4. **Authentication → Providers → Google**: enable it (create OAuth credentials in Google Cloud
   Console; authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`).
5. **Authentication → URL Configuration** (required for sticky login + BharatBol branding):
   - **Site URL** = your production origin (e.g. `https://bharatbol.pages.dev` or custom domain) —
     *not* the `*.supabase.co` API host. This is what Supabase uses as the default return target.
   - **Redirect URLs** must include every origin the SPA is served from, e.g.
     `https://bharatbol.pages.dev/**`, your custom domain `/**`, and `http://localhost:5173/**`.
   - The Google consent screen still routes through `https://<project-ref>.supabase.co` as the
     OAuth client — that host string is Google’s redirect, not our product name. To show
     **BharatBol** instead of a raw project URL on the consent screen:
     1. Google Cloud Console → APIs & Services → OAuth consent screen → **App name = BharatBol**
     2. Application home page / privacy = your `VITE_SITE_URL`
     3. Keep Supabase as the authorized redirect URI as above
   - Client `signInWithOAuth` uses `window.location.origin` + current path as `redirectTo`
     (PKCE). After Google, the session is stored in `localStorage`; if login “doesn’t stick”,
     the usual cause is a redirect URL missing from the allow list.

## 2. Environment

```bash
cp .env.example .env   # fill VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL, VITE_REPO_URL
```

**Demo mode & launch:** with no `VITE_*` values, `npm run dev` serves sample data — on
`localhost` only. A production *build* without `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` is refused by Vite (see `vite.config.ts`). That is deliberate:
real visitors must never be shown demo numbers as if they were real counts, and a
deployed "Configuration error" page must not be the first signal that Build variables
were missing.

To ship a live site there is exactly one step that matters:

1. Set the four `VITE_*` variables as **Build variables** in Cloudflare (see §3).
2. Trigger a **fresh deployment**. Adding or editing a variable does not rebuild an
   existing deploy — the previous bundle stays live until a new build runs.

**Build vs runtime (the usual footgun):** `VITE_*` are inlined into the client JS by
Vite at build time. Cloudflare **runtime** bindings, Worker secrets, and the
`vars` block in `wrangler.jsonc` are *not* visible to that build. Putting
`SUPABASE_URL` only in wrangler `vars` feeds the OG Worker; it does **not** configure
the React app. If the live host ever shows "Configuration error", check Build
variables first, then rebuild.

**Verify the bundle** after a deploy (optional sanity check):

```bash
curl -sS https://<your-workers-host>/ | grep -oE '/assets/index-[^"]+\.js'
# then:
curl -sS https://<your-workers-host>/assets/index-<hash>.js | grep -o 'https://[^"]*\.supabase\.co'
```

You should see your project URL. If `grep` is empty, the build ran without Build variables.

## 3. Cloudflare Workers (static assets)

Deployment is pinned by [`wrangler.jsonc`](../wrangler.jsonc) — that file's presence is
deliberate: it stops Workers Builds from auto-configuring the project through the
Cloudflare Vite plugin (which would require Vite ≥ 6 and rewrite our build pipeline).

### Branch → environment

| Git branch | Cloudflare environment | URL |
|---|---|---|
| `main` | Production | primary `*.workers.dev` (later custom domain) |
| `develop` | Preview / staging | `*-bharatbol.<account>.workers.dev` preview URL |

Feature work: branch → PR → merge into `develop` (not `main`). Promote `develop` → `main`
only when staging looks right.

### Dashboard setup

- Workers & Pages → this Worker → **Settings → Build** (or Variables):
  - Build command: `npm run build`
  - Add all four `VITE_*` as **Build variables** on **both Production and Preview**.
    Preview without them will fail the build (good) or, on older deploys, show the
    config-error screen.
- **Settings → Builds → Branch control** (wording varies): production branch = `main`;
  enable preview deployments for `develop` (and optionally other non-main branches).
- **From your machine:** `npx wrangler login && npx wrangler deploy` (deploys the
  current working tree to Production; CI/dashboard is preferred for branch flow).
- Validate config without deploying: `npx wrangler deploy --dry-run`.
- Test the built site plus the Worker locally: `npm run build && npx wrangler dev`.

Routing: only `/stand/*` invokes the Worker (`run_worker_first`), which rewrites Open Graph
tags per stand for link previews; every other path is served straight from Cloudflare's CDN,
with `not_found_handling: single-page-application` resolving client-side routes. Reads are
absorbed by the CDN — only writes and realtime touch Supabase, which is what keeps millions
of viewers free.

The Worker's runtime `vars` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) live in `wrangler.jsonc`.
Both are public by design (and match what should also be inlined in the client bundle via
`VITE_*` Build variables); never add the service-role key or the registrar private key there.

## 4. Merkle checkpoints (paused)

Account-linked mode does **not** append anonymous ballots, so the ballot-log Merkle
workflow is parked. Leave the GitHub Action idle until blind ballots are restored
(see [privacy-architecture.md](privacy-architecture.md)). Do not treat
`checkpoints/roots.jsonl` as live verification of current stands.

## 5. Verify end-to-end

Sign in on the deployed site, stand on an issue, and confirm: the count bumps live in a second
browser (including while signed out), your name appears on the wall (if opted in), withdrawal
decrements the count, and account deletion (Profile → delete) removes commitments and erases
the account. Watch evidence and national totals without signing in.
Run `npm test` on every change to the schema or functions.

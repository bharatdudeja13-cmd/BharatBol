# Deploying BharatBol

Vercel is the primary BharatBol deployment:

`https://bharatbol.vercel.app`

Cloudflare Worker deployment remains available as an alternate host. It is not the canonical site.

## Supabase

Run these migrations once, in order:

1. `supabase/schema.sql`
2. `supabase/phase2_privacy.sql`
3. `supabase/phase2b_public_log.sql`
4. `supabase/phase3_polls.sql`
5. `supabase/phase4_feed.sql`
6. `supabase/phase5_feed_reactions.sql`
7. `supabase/phase6_account_stands.sql`
8. `supabase/phase7_geography.sql`

The live application uses account-linked `stand_commitments` and `feed_item_reactions`. Public count views expose aggregates only. `stand_pulse` is the identity-free public ledger event stream.

Deploy the active Edge Functions:

```bash
supabase functions deploy feed-submit feed-moderate
supabase functions deploy feed-report --no-verify-jwt
```

`feed-submit` publishes validated links immediately. `feed-report` is open to people without an account and moves a reported item out of public feed reads. Add an administrator when you need to use `/admin`:

```sql
insert into public.admins (user_id) values ('<your auth.users id>');
```

## Google sign-in

There are two different redirect settings.

### Google Cloud OAuth client

Add this exact Authorized redirect URI:

`https://byfwdrazysblopnlahmx.supabase.co/auth/v1/callback`

Google redirects to Supabase first. Do not add a BharatBol URL as a Google Authorized redirect URI.

### Supabase Authentication URL Configuration

Set:

- **Site URL:** `https://bharatbol.vercel.app`
- **Redirect URLs:**
  - `https://bharatbol.vercel.app/**`
  - `https://bharatbol.bharat-dudeja13.workers.dev/**`
  - `http://localhost:5173/**`

The app uses the visitor's current origin as its return URL. The Vercel return URL is normally `https://bharatbol.vercel.app/`.

In the Google consent screen, set:

- Application home page: `https://bharatbol.vercel.app`
- Privacy policy: `https://bharatbol.vercel.app/privacy`
- App name: `BharatBol`

## Vercel

Import the Git repository into Vercel. The project needs no custom build command beyond:

```text
npm run build
```

Set these build-time environment variables for Production and Preview:

```text
VITE_SUPABASE_URL=https://byfwdrazysblopnlahmx.supabase.co
VITE_SUPABASE_ANON_KEY=<Supabase publishable key>
VITE_SITE_URL=https://bharatbol.vercel.app
VITE_REPO_URL=https://github.com/bharatdudeja13-cmd/BharatBol
```

`VITE_*` variables are compiled into the browser bundle. Changing one requires a new deployment.

[`vercel.json`](../vercel.json) keeps serverless and static files intact, then sends unknown paths to the React app. This is required for direct visits to `/privacy`, `/about`, `/stand/:id`, and other client-side routes.

[`api/ig-poster/[shortcode].ts`](../api/ig-poster/[shortcode].ts) provides the Vercel same-origin Instagram poster proxy used by reel thumbnails. It mirrors the Cloudflare Worker route.

## Public ledger

`/ledger` reads the public `stand_pulse` event stream and recomputes totals in the browser. The scheduled ledger checkpoint workflow signs Merkle roots into Rekor and commits checkpoint metadata to `checkpoints/roots.jsonl`.

Set these GitHub Actions secrets for the checkpoint workflow:

```text
LEDGER_SIGNING_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
```

Generate a signing key with:

```bash
node scripts/generate-ledger-key.mjs
```

Commit the public key to `src/config/ledgerKey.ts`; keep the private key only in GitHub Actions secrets. Anyone can recount the ledger with:

```bash
node scripts/recount-ledger.mjs
```

## Verify a deployment

1. Visit `https://bharatbol.vercel.app/privacy` directly and confirm it loads.
2. Sign in, take a stand, and confirm the count updates in a signed-out browser.
3. Open `/ledger` and verify the event is visible.
4. Open a real Instagram reel in the Feed and confirm its thumbnail is served from `/api/ig-poster/:shortcode`.
5. Submit and report a public feed link to confirm immediate publication and removal for review.

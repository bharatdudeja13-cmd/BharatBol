# Deploying — operator guide

Operational setup for running a live instance. (Product story, trust-critical paths, and
guardrails live in the [README](../README.md); the privacy design is in
[privacy-architecture.md](privacy-architecture.md).)

## 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run [`supabase/schema.sql`](../supabase/schema.sql), then
   [`supabase/phase2_privacy.sql`](../supabase/phase2_privacy.sql), then
   [`supabase/phase2b_public_log.sql`](../supabase/phase2b_public_log.sql),
   [`supabase/phase3_polls.sql`](../supabase/phase3_polls.sql) and
   [`supabase/phase4_feed.sql`](../supabase/phase4_feed.sql), once each, in that order.
3. Generate the registrar key pair and deploy the Edge Functions:
   ```bash
   node scripts/generate-registrar-key.mjs   # prints public + private JWK
   # paste the PUBLIC JWK into src/config/registrarKey.ts (commit it)
   supabase secrets set REGISTRAR_PRIVATE_JWK='<private jwk json>' \
                        REGISTRAR_PUBLIC_JWK='<public jwk json>'
   supabase functions deploy registrar-issue
   supabase functions deploy ballot-cast ballot-withdraw --no-verify-jwt
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
   `--no-verify-jwt` on the ballot functions is deliberate, not a shortcut: they are
   anonymous by design (the registrar's blind signature is the only admission control),
   and the gateway's JWT check would also reject the new non-JWT `sb_publishable_...`
   API keys. `registrar-issue` keeps gateway JWT verification — it receives the user's
   session JWT.
4. **Authentication → Providers → Google**: enable it (create OAuth credentials in Google Cloud
   Console; authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`).
5. **Authentication → URL Configuration**: set Site URL to your Pages domain and add it to
   Redirect URLs (plus `http://localhost:5173` for development).

## 2. Environment

```bash
cp .env.example .env   # fill VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL, VITE_REPO_URL
```

**Demo mode & launch:** with no `VITE_*` values the app serves sample data — on
`localhost` only. A production build on any other host with missing config renders a
visible "Configuration error" screen instead: real visitors are never shown demo numbers
as if they were real counts. To "disable demo mode" for launch there is exactly one step:
set the four `VITE_*` variables as build-time environment variables in the host settings
(they are inlined by Vite at build).

## 3. Cloudflare Workers (static assets)

Deployment is pinned by [`wrangler.jsonc`](../wrangler.jsonc) — that file's presence is
deliberate: it stops Workers Builds from auto-configuring the project through the
Cloudflare Vite plugin (which would require Vite ≥ 6 and rewrite our build pipeline).

- **From the dashboard:** Workers & Pages → connect this repo. Build command `npm run build`,
  and add the four `VITE_*` variables as **build-time** environment variables (they are inlined
  into the client bundle by Vite).
- **From your machine:** `npx wrangler login && npx wrangler deploy`.
- Validate config without deploying: `npx wrangler deploy --dry-run`.
- Test the built site plus the Worker locally: `npm run build && npx wrangler dev`.

Routing: only `/stand/*` invokes the Worker (`run_worker_first`), which rewrites Open Graph
tags per stand for link previews; every other path is served straight from Cloudflare's CDN,
with `not_found_handling: single-page-application` resolving client-side routes. Reads are
absorbed by the CDN — only writes and realtime touch Supabase, which is what keeps millions
of viewers free.

The Worker's runtime `vars` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) live in `wrangler.jsonc`.
Both are public by design and already inlined in the client bundle; never add the
service-role key or the registrar private key there.

## 4. Merkle checkpoints (tamper-evidence)

Add two GitHub Actions secrets — `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the
publishable key; it is public by design) — and the
[checkpoint workflow](../.github/workflows/checkpoint.yml) will commit a Merkle root
over the public ballot log to `checkpoints/roots.jsonl` every 6 hours. Trigger the
first run manually (Actions → Merkle checkpoint → Run workflow). Verification
instructions for anyone: [checkpoints/README.md](../checkpoints/README.md).

## 5. Verify end-to-end

Sign in on the deployed site, stand on an issue, and confirm: the count bumps live in a second
browser, your name appears on the wall (if opted in), withdrawal decrements the count, and
account deletion (Profile → delete) withdraws this browser's ballots and erases the account.
Run `npm test` — the unlinkability gate must pass on every change to the schema or functions.

# Deploying — operator guide

Operational setup for running a live instance. (Product story, trust-critical paths, and
guardrails live in the [README](../README.md); the privacy design is in
[privacy-architecture.md](privacy-architecture.md).)

## 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run [`supabase/schema.sql`](../supabase/schema.sql), then
   [`supabase/phase2_privacy.sql`](../supabase/phase2_privacy.sql), once each, in that order.
3. Generate the registrar key pair and deploy the Edge Functions:
   ```bash
   node scripts/generate-registrar-key.mjs   # prints public + private JWK
   # paste the PUBLIC JWK into src/config/registrarKey.ts (commit it)
   supabase secrets set REGISTRAR_PRIVATE_JWK='<private jwk json>' \
                        REGISTRAR_PUBLIC_JWK='<public jwk json>'
   supabase functions deploy registrar-issue
   supabase functions deploy ballot-cast ballot-withdraw --no-verify-jwt
   ```
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

## 3. Cloudflare Pages

- Create a Pages project from this repo. Build command `npm run build`, output directory `dist`,
  and add the four `VITE_*` environment variables.
- Or deploy directly: `npx wrangler pages deploy dist`.
- `public/_redirects` already routes all paths to the SPA. Cloudflare’s CDN absorbs read traffic;
  only writes and realtime touch Supabase — which is what keeps millions of viewers free.

## 4. Verify end-to-end

Sign in on the deployed site, stand on an issue, and confirm: the count bumps live in a second
browser, your name appears on the wall (if opted in), withdrawal decrements the count, and
account deletion (Profile → delete) withdraws this browser's ballots and erases the account.
Run `npm test` — the unlinkability gate must pass on every change to the schema or functions.

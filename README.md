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
| [`supabase/schema.sql`](supabase/schema.sql) | The entire privacy model. `stand_joins` (the only table linking an account to a stand) is **never publicly selectable** and never joined into any public view. Everything public reads from `wall_events`, which has **no user_id column at all**. `unique(stand_id, user_id)` keeps counts honest. Erasure cascades: deleting the auth user removes profile, joins, and wall entries — counts drop accordingly. |
| [`src/state/StandsProvider.tsx`](src/state/StandsProvider.tsx) | Counting: initial load from aggregate views, realtime bumps from `wall_events` inserts, optimistic UI de-duplicated by `join_id`. |
| [`src/lib/cards.ts`](src/lib/cards.ts) | Share cards are drawn entirely client-side; nothing is uploaded. |
| [`src/pages/About.tsx`](src/pages/About.tsx) | The honest-count methodology and the plainly stated MVP privacy trade-off. |

**The honest MVP trade-off** (also stated on the About page): to guarantee one-account-one-stand,
the private `stand_joins` table stores `user_id` per stand. The database could therefore
*internally* link account → stand. Acceptable for neutral, low-risk stands; not the full
unlinkable design. Do not add sensitive stands until that hardening ships.

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
2. Open the **SQL editor** and run [`supabase/schema.sql`](supabase/schema.sql) once.
3. **Authentication → Providers → Google**: enable it (create OAuth credentials in Google Cloud
   Console; authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`).
4. **Authentication → URL Configuration**: set Site URL to your Pages domain
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

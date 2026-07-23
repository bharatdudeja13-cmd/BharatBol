# BharatBol: Bharat, speak. <img src="public/icons/icon.svg" width="28" align="top" alt="">

**BharatBol** (भारत बोल, “Bharat, speak”) is a mobile-first, installable PWA for people to follow civic issues, share public evidence links, and take a public stand on an issue. It is independent, non-partisan, and not affiliated with a government, party, or election authority.

> **Public counts. Private identities.**

Counts reflect activity on BharatBol. They are not a census, survey, or election result.

## Features

- **Live counts:** per-stand totals, daily movement, state breakdowns, and a national total update in real time.
- **Account-backed stands:** Google sign-in enforces one stand per account per issue. A person can withdraw a stand or delete their account.
- **Supporter wall:** first name and state are public only when the person opts in.
- **Public ledger:** each stand or withdrawal adds an identity-free event to `stand_pulse`. The ledger can be downloaded, recounted, and checked against signed Rekor checkpoints.
- **Issue feed:** citizens submit public Instagram, YouTube, and X links. Links are published immediately, remain on the original platform, and are never re-hosted.
- **Evidence review:** source platforms provide the first layer of content enforcement. BharatBol's automated review audits evidence daily and removes links that are clearly wrong or break its rules. Anyone can also report a link, which removes it from the public feed until review is complete.
- **Privacy controls:** the feed never identifies a submitter. Account-linked profile, stand, reaction, and submission records can be deleted from the profile page.
- **PWA:** share-target support, install support, English and Hindi, reduced-motion support, and visible keyboard focus states.

## Stack

Vite, React, TypeScript, Tailwind, Supabase, and Vercel. Cloudflare Worker support remains available for the alternate deployment.

## Current data model

The live application uses account-linked stands and reactions. The private database can associate a signed-in account with its stands and reactions; public pages show counts only unless a person opts into the supporter wall. This is the current product model and is described in the [privacy policy](https://bharatbol.vercel.app/privacy).

The public ledger is separate from those account records. It exposes only `id`, `stand_id`, `delta`, and timestamp from `stand_pulse`, never an account identifier. Signed checkpoints make changes to the published ledger detectable. The ledger proves the published event sequence and totals; it does not prove that BharatBol represents all citizens.

## Trust-critical paths

| Path | Purpose |
| --- | --- |
| [`supabase/phase6_account_stands.sql`](supabase/phase6_account_stands.sql) | Live account-linked stands and reactions, RLS, public aggregate views, and live pulse events. |
| [`supabase/phase7_geography.sql`](supabase/phase7_geography.sql) | Public count aggregates, stand geography, and feed geography. |
| [`supabase/functions/feed-submit/index.ts`](supabase/functions/feed-submit/index.ts) | URL validation, privacy-tag stripping, deduplication, rate limiting, metadata lookup, and immediate publication. |
| [`supabase/functions/feed-report/index.ts`](supabase/functions/feed-report/index.ts) | Open reporting route that pulls a reported item from the public feed for review. |
| [`src/pages/Ledger.tsx`](src/pages/Ledger.tsx) | Public ledger, downloadable event log, browser-side recount, and checkpoint comparison. |
| [`scripts/recount-ledger.mjs`](scripts/recount-ledger.mjs) | Recounts the live public ledger and checks signed checkpoints. |
| [`docs/privacy-architecture.md`](docs/privacy-architecture.md) | Current privacy, account deletion, and public-ledger model. |
| [`docs/content-feed-design.md`](docs/content-feed-design.md) | Current feed publication, review, and removal policy. |

## Guardrails

1. Every stand is issue-framed, never person-framed.
2. BharatBol does not favour or attack any party.
3. Evidence links are unverified and point to the original source.
4. Content that identifies people, shows graphic violence, targets people or communities, exploits minors, contains sexual content, is clearly false, or is off-topic may be removed.
5. The service measures sentiment and does not instruct action.

## Local development

```bash
npm install
npm run dev
```

Without Supabase variables, demo data is available only on localhost. Production builds require real Supabase build variables.

## Deployment

Vercel is the primary deployment. Set `VITE_SITE_URL=https://bharatbol.vercel.app` and configure the Supabase and Google OAuth values in [docs/DEPLOY.md](docs/DEPLOY.md).

## License

[MIT](LICENSE)

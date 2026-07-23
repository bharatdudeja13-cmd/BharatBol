# Content feed design

## Publication

Anyone with a BharatBol account can submit a public Instagram, YouTube, or X link by sharing to the installed PWA or pasting a link at `/add`. The service strips personal share tags, normalises the link, rate-limits submissions, and deduplicates the canonical URL.

Validated links are published immediately. BharatBol relies on the source platform's own rules and enforcement as the first content safeguard. BharatBol's automated review audits evidence daily and removes links that are clearly wrong or violate the rules below. A public report also removes an item from feed reads until review is complete.

Publication does not mean that BharatBol certifies a claim. Every item is labelled unverified and links to the original post.

## Data and privacy

`feed_items` contains the public link, allowed public metadata, issue, geography, and status. It has no submitter identifier. `submission_ledger` privately associates an account with a canonical URL for rate limits, duplicate handling, and takedown work. It has row-level security, no public policy, and no client access.

No video or image is stored by BharatBol. YouTube plays through the privacy-enhanced player. Instagram uses a same-origin poster proxy and opens the original reel. X opens the original post. Removing a source post can leave the BharatBol link unavailable.

## Rules for removal

Evidence may be removed when it:

- identifies or exposes a private person;
- shows graphic violence or gore;
- targets or incites against a person, party, company, community, or religion;
- contains sexual content or endangers a minor;
- is clearly false or misleading;
- is not relevant to a civic issue in India; or
- is a duplicate, copyright objection, or other valid takedown case.

## Enforcement points

- URL allowlist, canonicalisation, privacy-tag stripping, deduplication, and rate limits: `feed-submit`.
- Immediate public publication: `feed-submit` writes `status: 'approved'`.
- Daily automated review and operator removal: the moderation workflow and `/admin`.
- Viewer and creator reports: `feed-report`, which moves an item to `re_review`.
- Public visibility: the `approved feed items are public` RLS policy.
- Submitter privacy: sealed `submission_ledger` plus `tests/feed-privacy.test.ts`.

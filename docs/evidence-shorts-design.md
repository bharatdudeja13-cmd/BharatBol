# Evidence shorts — end-to-end design

**Status: building.** Temporary policy change flagged below.

## Guardrail note (temporary)

The constitution says **moderation before public**. For this phase the human
asked to **auto-publish every submission** so evidence can land immediately.
Safety net that stays:

- Report → `re_review` (hide from public) until a human looks
- Keyword pre-screen still sets `flagged` (visible to `/admin`)
- Every item stays labelled **unverified**
- Link + embed only — **never re-host** media bytes
- Submitter never shown; share tags stripped before storage

Re-enable human-before-public by flipping `feed-submit` back to `pending` and
restoring the Admin approve gate. Do not silently drop the report path.

## Flow

```
Citizen sees reel (IG / YT / X)
    → Share to BharatBol PWA or paste on /add
    → Tags scrubbed → issue + state → submit
    → status=approved immediately (temporary)
    → appears under that issue’s Evidences + state filter

Home tilegram: tap state
    → state panel lists stands + “View evidence from {state}”
    → /evidence?state=DL  (optional &issue=)

Stand detail / Feed issue chip
    → Evidences strip for that issue (optional state)
    → tap card → /evidence?issue=…&state=…&id=…

Evidence player (/evidence)
    → full-viewport vertical snap scroll (shorts UX)
    → ONLY submitted evidence in the filtered set
    → active slide mounts player; neighbours are thumbnails only
    → YouTube: youtube-nocookie embed (no Google account required)
    → Instagram: official /embed/ iframe (public reels; no Meta login in-app)
    → X: titled card + open original (X embeds are account-hostile)
    → anonymous Useful / Not useful (phase5 reactions)
    → Report (existing hide-on-report)
    → “You’ve seen it — now stand” → related stand
```

## Optimization rules

1. Mount at most **one** heavy iframe (current) + prefetch next thumbnail.
2. `scroll-snap-type: y mandatory`; each slide `100dvh`.
3. Pause/tear down iframe when slide leaves the center (±0.6 intersection).
4. Page size 40; append on near-end scroll.
5. No autoplay sound (browser policy + civility); unmute control on slide.
6. Prefer poster/thumbnail until the slide is active.

## Data

No new content table: `feed_items` *are* evidences.
Indexes already: `(status, approved_at)`, `(issue, state)`.
Reactions: `supabase/phase5_feed_reactions.sql` (anonymous nullifier model).

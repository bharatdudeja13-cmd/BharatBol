# Content feed — design

**Status: PR gate — reviewed as the first commit of the feed/flag PR.**

BharatBol becomes the place where citizens *see what is happening*, segregated by issue and
state: anyone watching a reel/post/video about a civic issue gets it into BharatBol in
seconds; after human moderation it appears on a public issue feed, and every feed page
routes the viewer back to counted action ("You've seen it — now stand / vote").

## 1. Ingestion — two paths, both first-class

**A. Share-to-BharatBol (installed PWA).** The manifest registers a Web Share Target
(`GET /add?url=…&text=…&title=…`), so the installed app appears in Instagram/X/YouTube
share sheets. Landing on `/add` starts the guided flow: **issue → state → submit** —
three thumb-taps.

**B. Copy-link paste (works everywhere, including iOS).** iOS Safari does not support Web
Share Target for PWAs, so `/add` is equally reachable from an "Add to feed" entry in the
nav/feed: paste a link, the platform is auto-detected and metadata pre-filled, then the
same issue → state → submit flow. Path B is complete on its own; PWA install is suggested
("share directly next time") but never assumed.

Both paths require login — for rate-limiting and abuse control only. **The public never
sees who submitted anything.**

## 2. Data model

```
feed_items (PUBLIC reads: approved rows only)
  id uuid · url · url_canon (unique — global dedup) · platform (youtube|x|instagram|other)
  title/thumbnail_url/author_name  ← official oEmbed metadata only
  issue (curated slug) · state (tilegram code) · flagged bool (auto pre-flag)
  status: pending → approved | rejected(reason) | needs_info ;  approved → re_review (on report) → approved | rejected
  reject_reason · reports int · submitted_on (DATE only — no fine timing) · approved_at

submission_ledger (SEALED: RLS enabled, zero policies, zero grants, service-role only)
  user_id · url_canon · submitted_on

admins (SEALED, same pattern)
  user_id
```

**The deliberate, disclosed asymmetry.** Ballots are cryptographically unlinkable (§1) —
counting must never identify. Feed submissions are *authored content*: abuse control,
duplicate policing, and a real takedown/grievance posture (see §7) require the operator to
know privately who submitted what. So `submission_ledger` links account→submission **in a
sealed table**, exactly as disclosed here and in the moderation policy. What is promised —
and enforced by tests — is: **no table readable by the app or by the public exposes
submitter identity; `feed_items` has no submitter column at all.** This does not touch or
weaken the §1 ballot model.

**Dedup.** `url_canon` canonicalization: normalize host (`youtu.be`→`youtube.com/watch`,
`twitter.com`→`x.com`), strip tracking params (`utm_*`, `si`, `feature`, `igsh`…),
lowercase host, drop fragments/trailing slashes. Unique constraint = one feed item per
canonical URL, ever; resubmits get "already submitted".

**Anti-abuse.** Per-account rate limit (5/day, tunable in the Edge Function) via the
ledger; URL allowlist (YouTube, X, Instagram hosts only at launch); auto pre-flag
(§3) prioritizes review, never auto-publishes.

## 3. Moderation — nothing public until a human approves

1. **Automated pre-checks (at submit):** URL allowlist + parse; canonical dedup;
   rate limit; a conservative keyword screen over fetched title/author that only sets
   `flagged=true` for **priority human review** — it never auto-approves or auto-rejects.
2. **Human review (admin UI, `/admin`):** members of `admins` see the pending queue
   (flagged first), can **approve** (confirming/correcting issue + state), **reject**
   with a reason code — `doxxing · violence · targeting · sexual · minor · misinfo ·
   offtopic · duplicate · other` — or mark **needs-info**.
3. **Reports (viewers, creators, affected parties):** every public item has a report
   button (no login required — creators and affected people may have no account). Per the
   spec, **a reported item is pulled to `re_review` immediately** and disappears from the
   public feed until a human re-reviews. Trade-off stated honestly: one bad-faith report
   can temporarily hide an item; at scale this needs a threshold/trust model — accepted
   for launch because wrongly-hidden beats wrongly-shown for this content class.
4. **Scaling path (flagged, not built):** moderation is solo-operator today. The design
   keeps every decision in one place (`feed-moderate` function + status/reason columns) so
   it can move to a small neutral panel later: multiple `admins`, two-person agreement for
   rejections in sensitive reason codes, and a public moderation log are the natural next
   steps — panel composition is an owner/human decision, not an agent one.

**Published policy:** `/moderation` page, EN + हिंदी, states the content rules (§4), the
report path, and the disclosed private ledger.

## 4. Content guardrails (rejection grounds — enforced in policy, admin UI reason codes, and pre-flag list)

Rejected regardless of viewpoint: **doxxing or personal identification of anyone**
(protesters, police, officials, private citizens); **graphic violence/gore**; content
**targeting or inciting against a person, party, community, or religion**; **sexual
content**; anything **endangering a minor**; **clear misinformation**. The feed is about
issues, never attacks on people. Issue categories and all editorial copy stay neutral.

## 5. Embedding — link + embed, never re-host

Stored: URL + official-oEmbed public metadata (title, author, thumbnail URL). Rendered:

| Platform | Treatment |
| --- | --- |
| YouTube | Official `youtube-nocookie.com` iframe player, loaded on tap (thumbnail first — no third-party requests until the viewer chooses). |
| X | Official oEmbed (`publish.twitter.com/oembed`, no key) for title/author; rendered as a titled link-card opening the original. (Full script-based embed is a later enhancement; it requires the platform's widgets script.) |
| Instagram | oEmbed requires a Facebook app token. Without one (launch state): **titled link-card that opens Instagram — no scraping, ever.** With a token later: thumbnail cards. |

Nothing is downloaded, copied, or re-hosted; deleting the original kills the content
everywhere (the card link simply dies — honest by construction).

**Provenance labels on every item:** source platform, original link, date, and
**"unverified — links to original"**. BharatBol never presents a feed item as verified
fact. Optional (later): hash(url)+date appended to the §2 tamper-evident log so takedowns
of *our records* are also evident.

## 6. The feed

`/feed`: browse by issue (curated chips, aligned with Stands/Polls taxonomy in
`src/config/issues.ts`) and filter by state (tilegram codes). Calm editorial cards —
thumbnail/player, issue + state tags, source + date + unverified label, report button —
sorted newest-first. Viewable without login. **Loop-back:** each item (and each issue
header) surfaces the related Stand/Poll by category: *"You've seen it — now stand."*

## 7. Honest legal note (owner's human task before large-scale launch)

Aggregating third-party content with moderation edges BharatBol toward **intermediary**
status under India's IT Rules at scale — due-diligence and grievance-officer obligations.
Not a launch blocker at this size; the report/takedown path and published policy keep the
posture defensible. Proper legal review is required before large-scale launch, and is a
human task — alongside the existing name-clearance task.

## 8. Enforcement points (where each rule lives)

- Submitter anonymity → schema (no submitter column in `feed_items`; sealed ledger) + `tests/feed-privacy.test.ts`.
- Approved-only public reads → RLS policy + test.
- Allowlist/canonical/dedup/rate-limit → `feed-submit` Edge Function + `src/lib/feedUrl.ts` unit tests.
- Human-only publishing → no code path sets `approved` outside `feed-moderate` (admin-gated).
- Report → `feed-report` function; status pull tested.
- Never re-host → no storage of media bytes anywhere; embeds tap-to-load.
- Non-partisan taxonomy → `src/config/issues.ts` review + seed content.

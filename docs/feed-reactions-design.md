# Feed reactions — design (like / dislike / comment)

**Status: approved and building** (`phase5_feed_reactions.sql` + Edge Functions + player UI).

BharatBol’s feed already promises: **the public never sees who submitted an item**,
and share tags that could fingerprint a sharer are stripped before storage. Any
reaction model (like, dislike, comment) must inherit that promise — and must not
weaken §1 ballot unlinkability.

## 1. What we will not do

- **Named comments or reaction lists** (“Bharat from Delhi liked this”). That is
  “show who,” and it is out.
- **Account-linked rows readable by the app** for who reacted to which item.
  A DB dump must not map `user_id → feed_item_id` for a like/dislike the way a
  naïve social app would.
- **Free-text public comments without moderation.** Feed content is already
  human-gated; unmoderated comments would re-open doxxing, targeting, and
  partisan pile-ons under a BharatBol URL.

## 2. Proposed model (anonymous counts, ballot-shaped)

Treat reactions as a **narrow civic signal**, not a social network:

| Signal | Meaning | Storage |
|---|---|---|
| **Seen it / useful** (👍) | “This helped me understand the issue” | Anonymous one-per-account spend |
| **Not useful** (👎) | “This doesn’t belong / not helpful” — *not* a pile-on against a person | Anonymous one-per-account spend |
| **Report** | Already built — hide-on-report → mod queue | No reporter identity stored |

**No public comment thread in v1.** If we later want “notes,” they should be
short, moderated, **anonymous** (no display name), and issue-framed — same
rejection grounds as the feed policy. Prefer routing people to **Stand / Poll**
(“You’ve seen it — now stand”) over inventing a second speech surface.

### Cryptography / tables (sketch — for review before SQL)

Reuse §1 shape, with a distinct signed-message domain so stand tokens cannot be
replayed as reactions:

- At sign-in, registrar blind-signs one token per `(account, feed_item)` for
  items the client asks about *or* issues on first react (prefer batch-on-view
  only if it doesn’t create a timing signal — details TBD).
- Signed message: `bharatbol:feedreact:v1:{feed_item_id}:{token}` — **reaction
  value not in the signed message** (same invariant as poll option_index).
- Anonymous table `feed_reactions`: `feed_item_id`, `nullifier` (unique),
  `value` (`up` \| `down`), `reacted_on` date-only. **No user_id.**
- Sealed `feed_reaction_issuance (user_id, feed_item_id)` — service-role only.
- Public read model: counts per item only; honest label
  “verified engaged citizens — not a census.”
- Change mind = withdraw by client-held receipt + re-cast same token.

This is intentionally heavier than a naive likes table. That cost is the point:
reactions that can be dumped into “who disliked what” are incompatible with the
constitution.

## 3. Product rules around reactions

- Counts labelled honestly; never invent unique-citizen numbers we cannot prove.
- Dislike is **about the item’s usefulness / fit**, never a tool to target a
  creator or community. UI copy must say so.
- Ranking: optional later (“useful” as a weak sort signal) — not at launch.
- Same content guardrails as the feed; a surge of dislikes can **priority-flag**
  for re-review without auto-hiding (unlike report, which already hides).

## 4. Share / comment on *external* platforms

When someone shares a BharatBol feed card *out* to WhatsApp/IG/X:

- Share URL is the **canonical public post or BharatBol feed deep link**, never
  a personal referral id.
- Do not append `?from=user` / invite codes that identify the sharer.
- Copy reminds: “Personal share tags are stripped when links come *into*
  BharatBol; when you share *out*, don’t add tracking.”

## 5. Open decisions (human)

1. Approve anonymous up/down (ballot-shaped) vs **no reactions at all** until
   after Merkle/recount spine for stands is fully public?
2. Are moderated anonymous notes ever wanted, or is Stand/Poll the only speech?
3. Should dislike auto-priority-flag at N, or stay purely informational?

**Next step after approval:** draft `supabase/phase5_feed_reactions.sql` + gate
tests, pause again before Edge Functions / UI.

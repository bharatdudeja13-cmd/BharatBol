# BharatBol privacy architecture

## Live model

BharatBol currently uses account-linked stands and reactions. A signed-in account can take one stand per issue and one reaction per feed item. The relevant private tables are `stand_commitments` and `feed_item_reactions`; both contain `user_id` and are protected by row-level security.

This means a database operator with authorised access can associate an account with its stands and reactions. Public visitors cannot read those rows. They see aggregate counts and, only where a person has opted in, a first name and state on the supporter wall.

## Data kept for each feature

| Feature | Private data | Public data |
| --- | --- | --- |
| Sign-in and profile | Google-authenticated account ID, email, first name, state, wall preference | Nothing by default |
| Stand | Account ID, stand ID, optional state, date | Totals and state aggregates |
| Reaction | Account ID, feed item ID, value, date | Aggregate useful and not-useful totals |
| Feed submission | Account ID and canonical URL in sealed `submission_ledger` | Link, permitted metadata, issue, geography, and publication state |
| Supporter wall | Account-linked first name and state only when enabled | First name and state |

## Public ledger

Each stand or withdrawal writes an event to `stand_pulse`: `id`, `stand_id`, `delta`, and `at`. It contains no account ID, email, name, or state. The public ledger page reads this event stream, recomputes totals in the browser, and compares its Merkle root with signed Rekor checkpoints committed to the repository.

The ledger makes the published sequence of stand events and its totals independently checkable. It does not make the underlying account-to-stand relationship anonymous, and it does not establish a population-wide measure of opinion.

Exact event times are public by design. In a quiet issue, someone who independently knows when a person acted may infer an event. This is a residual privacy risk.

## Controls and deletion

People can update their first name, state, and supporter-wall preference from the profile page. They can withdraw individual stands and delete their account. `delete_my_account()` removes the Supabase auth user; foreign-key cascades remove the profile, account-linked stands, reactions, and submission-ledger rows. Pulse events are retained as identity-free public-ledger records.

## Feed privacy and review

The public feed never exposes a submitter identity. `feed_items` has no submitter column; the account-to-submission mapping is stored only in the sealed `submission_ledger` table for rate limits, duplicate handling, and takedown work.

Links are published immediately after validation. Original platforms provide the first layer of content enforcement. BharatBol's automated review audits evidence daily and removes links that are clearly wrong or break BharatBol's rules. Anyone can report an item without signing in; a report immediately removes it from public feed reads until review is complete.

## Service providers

Google provides sign-in. Supabase provides authentication and database services. Vercel is the primary application host. Cloudflare may serve the alternate Worker deployment. Each provider may process standard service and request data under its own terms and privacy practices.

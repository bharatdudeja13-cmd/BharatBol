# Site flow — BharatBol

Account-linked stands; **public evidence** for everyone.

```mermaid
flowchart TD
  Home["Home: count + tilegram"]
  Home -->|"tap state"| Panel["Open stands + evidence"]
  Panel -->|"Watch"| Player["/evidence — no login"]
  Panel -->|"Stand"| Auth["Google login"]
  Auth --> Commit["stand_commitments"]
  Feed["/feed"] --> Player
  Add["/add scrubbed URL"] --> Items["feed_items approved"]
  Items --> Player
  Player -->|"Useful"| React["login-tied reactions"]
  Player -->|"Now stand"| Auth
```

## Rules

1. **Evidence is public** — approved `feed_items` readable by anon; submitter only in sealed ledger.
2. **Only standing (and reactions) need login.**
3. **Counts are public** — security-definer aggregates after phase7.

See `docs/DEPLOY.md` for Auth Site URL / Google consent branding as BharatBol.

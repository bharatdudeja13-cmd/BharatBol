# Merkle checkpoints

`roots.jsonl` holds one checkpoint per line, appended on a schedule by
[the checkpoint workflow](../.github/workflows/checkpoint.yml) and never rewritten:

```json
{"format":"bharatbol-checkpoint-v1","leaf":"bharatbol-log-leaf-v1 (RFC 6962 / SHA-256)",
 "size":14,"root":"238f…","stands":{"<stand-id>":5},"national":10,
 "generated_at":"2026-07-22T…Z"}
```

Each checkpoint commits to the first `size` events of the public, append-only
[`ballot_log`](../supabase/phase2b_public_log.sql) under the RFC 6962 Merkle root `root`,
alongside the totals a replay of those events produces.

## Verify it yourself — no account, no permission needed

```bash
node scripts/download-log.mjs > ballot-log.jsonl   # or use any instance's public REST API
node scripts/recount.mjs --file ballot-log.jsonl   # reproduce every displayed number
                                                   # and verify every committed root
node scripts/prove-inclusion.mjs <your-nullifier> --file ballot-log.jsonl
                                                   # prove YOUR anonymous ballot is counted
```

Your nullifier is in your receipts export (profile → export receipts). It proves your
ballot's inclusion **without revealing who you are** — that is the point of the design.

If a recount ever disagrees with a displayed count, or a committed root stops verifying,
the log has been altered. This directory is the evidence trail that makes such tampering
visible; it cannot make tampering impossible, and we do not claim otherwise.

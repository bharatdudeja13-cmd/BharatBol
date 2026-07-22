#!/usr/bin/env node
/**
 * Prove — without revealing any identity — that a ballot is included in
 * a publicly committed checkpoint. The nullifier comes from the citizen's
 * own receipt (profile → export receipts); nobody else can produce it.
 *
 *   node scripts/prove-inclusion.mjs <nullifier> [--file log.jsonl]
 *                                    [--checkpoints checkpoints/roots.jsonl]
 */
import { readFileSync } from 'node:fs';
import { inclusionProof, verifyInclusion } from './lib/merkle.mjs';
import { loadLog } from './lib/log.mjs';

const args = process.argv.slice(2);
const nullifier = args.find((a) => /^[0-9a-f]{64}$/.test(a));
if (!nullifier) {
  console.error('usage: node scripts/prove-inclusion.mjs <64-hex nullifier> [--file log.jsonl]');
  process.exit(2);
}

const events = await loadLog(args);
const index = events.findIndex((e) => e.event === 'cast' && e.nullifier === nullifier);
if (index < 0) {
  console.error('no cast event with that nullifier in this log copy');
  process.exit(1);
}

const cpIdx = args.indexOf('--checkpoints');
const cpPath = cpIdx >= 0 ? args[cpIdx + 1] : 'checkpoints/roots.jsonl';
const checkpoints = readFileSync(cpPath, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))
  .filter((cp) => cp.size > index && cp.size <= events.length);

if (checkpoints.length === 0) {
  console.error('no committed checkpoint covers this ballot yet — wait for the next scheduled checkpoint');
  process.exit(1);
}

const cp = checkpoints[checkpoints.length - 1];
const proof = await inclusionProof(events, index, cp.size);
const ok = await verifyInclusion(events[index], index, cp.size, proof, cp.root);

console.log(
  JSON.stringify(
    {
      nullifier,
      leaf_index: index,
      event: events[index],
      checkpoint: { size: cp.size, root: cp.root, generated_at: cp.generated_at },
      proof,
      verified: ok,
    },
    null,
    2
  )
);
if (!ok) {
  console.error('\nPROOF FAILED — this ballot is NOT under the committed root.');
  process.exit(1);
}
console.error('\nverified: this ballot is included in the publicly committed checkpoint.');

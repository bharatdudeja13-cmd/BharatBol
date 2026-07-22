#!/usr/bin/env node
/**
 * The open recount: replay the public ballot log and reproduce every
 * number BharatBol displays — then verify the log against the committed
 * Merkle checkpoints. Anyone can run this; no account needed.
 *
 *   node scripts/recount.mjs                          # live log from env/.env
 *   node scripts/recount.mjs --file log.jsonl         # from a local copy
 *   node scripts/recount.mjs --check checkpoints/roots.jsonl
 *
 * Same log + same script = same numbers. If a displayed count ever
 * differs from this recount, or a checkpoint fails, that is the signal
 * the design exists to give you.
 */
import { readFileSync, existsSync } from 'node:fs';
import { merkleRoot, replayCounts } from './lib/merkle.mjs';
import { loadLog } from './lib/log.mjs';

const args = process.argv.slice(2);
const events = await loadLog(args);

const { stands, national } = replayCounts(events);
console.log(`ballot log: ${events.length} events`);
console.log(`\nRECOUNT — verified engaged citizens per stand (casts − withdrawals):`);
for (const [standId, count] of Object.entries(stands)) {
  console.log(`  ${standId}  ${count}`);
}
console.log(`\nNATIONAL TOTAL (stands taken): ${national}`);
console.log(`merkle root over ${events.length} events:\n  ${await merkleRoot(events)}`);

const checkIdx = args.indexOf('--check');
const checkPath = checkIdx >= 0 ? args[checkIdx + 1] : 'checkpoints/roots.jsonl';
if (existsSync(checkPath)) {
  console.log(`\nverifying committed checkpoints in ${checkPath}:`);
  let failed = 0;
  const lines = readFileSync(checkPath, 'utf8').split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const cp = JSON.parse(line);
    if (cp.size > events.length) {
      console.log(`  size=${cp.size}  SKIP (log copy has only ${events.length} events)`);
      continue;
    }
    const root = await merkleRoot(events, cp.size);
    const ok = root === cp.root;
    if (!ok) failed++;
    console.log(`  size=${cp.size}  ${ok ? 'PASS' : `FAIL (expected ${cp.root}, log gives ${root})`}`);
  }
  if (failed > 0) {
    console.error(`\n${failed} checkpoint(s) FAILED — the log does not match what was publicly committed.`);
    process.exit(1);
  }
  console.log('\nall checkpoints verified against this log.');
} else if (checkIdx >= 0) {
  console.error(`checkpoint file not found: ${checkPath}`);
  process.exit(1);
}

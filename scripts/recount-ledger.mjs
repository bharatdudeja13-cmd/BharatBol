#!/usr/bin/env node
/**
 * Open recount of the public stand ledger. Reproduces every displayed
 * count from the anonymous stand_pulse log, recomputes the Merkle root,
 * and checks it against the committed, Rekor-signed checkpoints.
 *
 *   node scripts/recount-ledger.mjs                 # live pulse
 *   node scripts/recount-ledger.mjs --file pulse.jsonl
 *
 * No account needed. Same log + same script = same numbers.
 */
import { readFileSync, existsSync } from 'node:fs';
import { merkleRoot } from './lib/merkle.mjs';
import { canonicalEntry, replayLedger, eventOf } from './lib/ledger.mjs';
import { envConfig } from './lib/log.mjs';

const args = process.argv.slice(2);

async function fetchPulse() {
  const i = args.indexOf('--file');
  if (i >= 0) {
    return readFileSync(args[i + 1], 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  }
  const { url, key } = envConfig();
  if (!url || !key) throw new Error('set SUPABASE_URL and SUPABASE_ANON_KEY (or --file)');
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/stand_pulse?select=id,stand_id,delta,at&order=id.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok && res.status !== 206) throw new Error(`pulse fetch ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

const entries = await fetchPulse();
const leaves = entries.map((e) => ({ __canon: canonicalEntry(e) }));
const { stands, total } = replayLedger(entries);
const root = entries.length ? await merkleRoot(leaves) : '0'.repeat(64);

console.log(`stand ledger: ${entries.length} anonymous events`);
console.log('\nRECOUNT — net stands per issue (stood − withdrew):');
for (const [id, n] of Object.entries(stands)) console.log(`  ${id}  ${n}`);
console.log(`\nTOTAL stands taken: ${total}`);
console.log(`merkle root: ${root}`);

const path = 'checkpoints/roots.jsonl';
if (existsSync(path)) {
  console.log('\nverifying committed, Rekor-signed checkpoints:');
  let failed = 0;
  for (const line of readFileSync(path, 'utf8').split('\n').filter((l) => l.trim())) {
    const cp = JSON.parse(line);
    if (cp.size > entries.length) {
      console.log(`  size=${cp.size}  SKIP (log copy has ${entries.length})`);
      continue;
    }
    const r = await merkleRoot(leaves, cp.size);
    const ok = r === cp.root;
    if (!ok) failed++;
    console.log(`  size=${cp.size}  ${ok ? 'PASS' : 'FAIL'}  rekor#${cp.rekor_index ?? '—'}`);
  }
  if (failed) {
    console.error(`\n${failed} checkpoint(s) FAILED — the log does not match what was committed & signed.`);
    process.exit(1);
  }
  console.log('\nall checkpoints verified against this log.');
}
// eventOf is re-exported for downstream tooling / tests.
void eventOf;

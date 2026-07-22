#!/usr/bin/env node
/**
 * Build a Merkle checkpoint over the public ballot log.
 *
 *   node scripts/checkpoint.mjs                        # print checkpoint JSON
 *   node scripts/checkpoint.mjs --append checkpoints/roots.jsonl
 *   node scripts/checkpoint.mjs --file log.jsonl       # from a local log copy
 *
 * A checkpoint commits to the first `size` log events:
 *   { format, size, root, national, stands, generated_at }
 * Appending is skipped when the log hasn't grown, so the committed
 * roots file only ever gains lines for new events.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { merkleRoot, replayCounts } from './lib/merkle.mjs';
import { loadLog } from './lib/log.mjs';

const args = process.argv.slice(2);
const events = await loadLog(args);

const checkpoint = {
  format: 'bharatbol-checkpoint-v1',
  leaf: 'bharatbol-log-leaf-v1 (RFC 6962 / SHA-256)',
  size: events.length,
  root: await merkleRoot(events),
  ...replayCounts(events),
  generated_at: new Date().toISOString(),
};

const appendIdx = args.indexOf('--append');
if (appendIdx < 0) {
  console.log(JSON.stringify(checkpoint, null, 2));
  process.exit(0);
}

const path = args[appendIdx + 1];
mkdirSync(dirname(path), { recursive: true });
const lines = existsSync(path)
  ? readFileSync(path, 'utf8').split('\n').filter((l) => l.trim())
  : [];
const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;

if (last && last.size === checkpoint.size && last.root === checkpoint.root) {
  console.log(`no new events since checkpoint size=${last.size}; nothing to append`);
  process.exit(0);
}
if (last && last.size > checkpoint.size) {
  console.error(
    `REGRESSION: log (${checkpoint.size}) is SHORTER than the last checkpoint (${last.size}) — the append-only log has been truncated. Refusing to checkpoint.`
  );
  process.exit(1);
}

writeFileSync(path, [...lines, JSON.stringify(checkpoint)].join('\n') + '\n');
console.log(`checkpoint appended: size=${checkpoint.size} root=${checkpoint.root}`);

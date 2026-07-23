#!/usr/bin/env node
/**
 * Build a Merkle checkpoint over the public stand ledger (`stand_pulse`)
 * and sign it into the Sigstore/Rekor public transparency log, then append
 * the signed checkpoint to checkpoints/roots.jsonl.
 *
 *   node scripts/checkpoint-rekor.mjs            # live pulse from env/.env
 *   node scripts/checkpoint-rekor.mjs --file pulse.jsonl
 *   node scripts/checkpoint-rekor.mjs --dry-run  # sign + verify, do NOT upload
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY (public), LEDGER_SIGNING_KEY (PEM,
 * private — GitHub Actions secret).
 *
 * Uploading writes a permanent public record to Rekor. It contains only a
 * hash + signature + our public key — no personal data, ever.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createSign, createHash } from 'node:crypto';
import { merkleRoot } from './lib/merkle.mjs';
import { canonicalCheckpoint, replayLedger } from './lib/ledger.mjs';
import { canonicalEntry } from './lib/ledger.mjs';
import { envConfig } from './lib/log.mjs';

const REKOR = 'https://rekor.sigstore.dev';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// The ledger's Merkle tree hashes canonicalEntry() strings as leaves; the
// merkle helper takes an event → canonical mapping.
function toLeafEvents(entries) {
  return entries.map((e) => ({ __canon: canonicalEntry(e) }));
}

async function fetchPulse() {
  const fileIdx = args.indexOf('--file');
  if (fileIdx >= 0) {
    return readFileSync(args[fileIdx + 1], 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  }
  const { url, key } = envConfig();
  if (!url || !key) throw new Error('set SUPABASE_URL and SUPABASE_ANON_KEY (or --file)');
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${url}/rest/v1/stand_pulse?select=id,stand_id,delta,at&order=id.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` } }
    );
    if (!res.ok && res.status !== 206) throw new Error(`pulse fetch ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function loadPrivateKey() {
  const pem = process.env.LEDGER_SIGNING_KEY;
  if (!pem) throw new Error('LEDGER_SIGNING_KEY not set');
  return pem.includes('BEGIN') ? pem : Buffer.from(pem, 'base64').toString('utf8');
}

function publicKeyPemFromConfig() {
  const src = readFileSync(new URL('../src/config/ledgerKey.ts', import.meta.url), 'utf8');
  const m = src.match(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/);
  if (!m) throw new Error('public key not found in src/config/ledgerKey.ts');
  return m[0];
}

async function uploadToRekor(artifact, signatureB64, publicKeyPem) {
  const body = {
    apiVersion: '0.0.1',
    kind: 'hashedrekord',
    spec: {
      data: { hash: { algorithm: 'sha256', value: createHash('sha256').update(artifact).digest('hex') } },
      signature: {
        content: signatureB64,
        publicKey: { content: Buffer.from(publicKeyPem).toString('base64') },
      },
    },
  };
  const res = await fetch(`${REKOR}/api/v1/log/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rekor upload ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const uuid = Object.keys(data)[0];
  const logIndex = data[uuid]?.logIndex ?? data[uuid]?.verification?.logIndex ?? null;
  return { uuid, logIndex };
}

// ---- main ----
const entries = await fetchPulse();
const size = entries.length;
const root = size > 0 ? await merkleRoot(toLeafEvents(entries)) : '0'.repeat(64);
const artifact = canonicalCheckpoint({ size, root });

const privateKeyPem = loadPrivateKey();
const publicKeyPem = publicKeyPemFromConfig();
const signature = createSign('SHA256').update(artifact).end().sign(privateKeyPem);
const signatureB64 = signature.toString('base64');

const checkpoint = {
  format: 'bharatbol-ledger-checkpoint-v1',
  size,
  root,
  ...replayLedger(entries),
  signed_at: new Date().toISOString(),
};

if (dryRun) {
  console.log('DRY RUN — signed, not uploaded:\n', JSON.stringify(checkpoint, null, 2));
  console.log('signature (base64):', signatureB64.slice(0, 44) + '…');
  process.exit(0);
}

const { uuid, logIndex } = await uploadToRekor(artifact, signatureB64, publicKeyPem);
checkpoint.rekor_uuid = uuid;
checkpoint.rekor_index = logIndex;
checkpoint.rekor_url = `https://search.sigstore.dev/?uuid=${uuid}`;

const path = 'checkpoints/roots.jsonl';
mkdirSync(dirname(path), { recursive: true });
const prev = existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()) : [];
const last = prev.length ? JSON.parse(prev[prev.length - 1]) : null;
if (last && last.size === size && last.root === root) {
  console.log(`no new entries since size=${size}; nothing appended (rekor entry ${uuid} created anyway)`);
} else {
  writeFileSync(path, [...prev, JSON.stringify(checkpoint)].join('\n') + '\n');
}
console.log(`checkpoint size=${size} root=${root}`);
console.log(`rekor: ${checkpoint.rekor_url} (index ${logIndex})`);

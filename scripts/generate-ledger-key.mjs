#!/usr/bin/env node
/**
 * Generates the ECDSA P-256 key pair that signs ledger checkpoints into
 * the Sigstore/Rekor public transparency log.
 *
 *   node scripts/generate-ledger-key.mjs
 *
 * - PUBLIC key (PEM)  → commit to src/config/ledgerKey.ts (auditable).
 * - PRIVATE key (PEM) → GitHub Actions secret LEDGER_SIGNING_KEY only.
 *   Never commit the private key.
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

console.log('=== PUBLIC KEY (commit in src/config/ledgerKey.ts) ===\n');
console.log(publicKey);
console.log('=== PRIVATE KEY (secret LEDGER_SIGNING_KEY — do NOT commit) ===\n');
console.log(privateKey);

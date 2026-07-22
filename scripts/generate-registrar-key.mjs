#!/usr/bin/env node
/**
 * Generates the registrar's RSA key pair for RFC 9474 blind signatures.
 *
 *   node scripts/generate-registrar-key.mjs
 *
 * - PUBLIC JWK  → paste into src/config/registrarKey.ts (committed, auditable)
 * - PRIVATE JWK → Edge Function secret only:
 *     supabase secrets set REGISTRAR_PRIVATE_JWK='<json>'
 *   Never commit the private key.
 */
import { RSABSSA } from '@cloudflare/blindrsa-ts';

const { privateKey, publicKey } = await RSABSSA.SHA384.generateKey({
  publicExponent: Uint8Array.from([1, 0, 1]),
  modulusLength: 2048,
});

const pub = await crypto.subtle.exportKey('jwk', publicKey);
const priv = await crypto.subtle.exportKey('jwk', privateKey);

console.log('=== PUBLIC JWK (commit in src/config/registrarKey.ts) ===\n');
console.log(JSON.stringify(pub, null, 2));
console.log('\n=== PRIVATE JWK (secret REGISTRAR_PRIVATE_JWK — do NOT commit) ===\n');
console.log(JSON.stringify(priv));

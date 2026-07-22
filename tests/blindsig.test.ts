/**
 * RFC 9474 blind-signature mechanics: the full registrar↔client protocol
 * exercised end-to-end in memory, including failure paths.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RSABSSA } from '@cloudflare/blindrsa-ts';
import {
  suite, ballotMessage, nullifierOf, randomTokenHex, blindForStand, finalizeReceipt,
} from '../src/lib/blind';

const STAND_A = '00000000-0000-4000-8000-000000000001';
const STAND_B = '00000000-0000-4000-8000-000000000002';

let keys: CryptoKeyPair;

beforeAll(async () => {
  keys = await RSABSSA.SHA384.generateKey({
    publicExponent: Uint8Array.from([1, 0, 1]),
    modulusLength: 2048,
  });
}, 60000);

describe('blind signature roundtrip', () => {
  it('blind → blindSign → finalize yields a signature that verifies', async () => {
    const session = await blindForStand(keys.publicKey, STAND_A);
    const blindSig = await suite().blindSign(keys.privateKey, b64ToBytes(session.blinded_b64));
    const receipt = await finalizeReceipt(keys.publicKey, session, bytesToB64(blindSig));
    const ok = await suite().verify(
      keys.publicKey,
      b64ToBytes(receipt.sig_b64),
      ballotMessage(receipt.stand_id, receipt.token)
    );
    expect(ok).toBe(true);
  });

  it('a signature for stand A does NOT verify for stand B (message binding)', async () => {
    const session = await blindForStand(keys.publicKey, STAND_A);
    const blindSig = await suite().blindSign(keys.privateKey, b64ToBytes(session.blinded_b64));
    const receipt = await finalizeReceipt(keys.publicKey, session, bytesToB64(blindSig));
    const ok = await suite().verify(
      keys.publicKey,
      b64ToBytes(receipt.sig_b64),
      ballotMessage(STAND_B, receipt.token) // same token, different stand
    );
    expect(ok).toBe(false);
  });

  it('a tampered token does not verify', async () => {
    const session = await blindForStand(keys.publicKey, STAND_A);
    const blindSig = await suite().blindSign(keys.privateKey, b64ToBytes(session.blinded_b64));
    const receipt = await finalizeReceipt(keys.publicKey, session, bytesToB64(blindSig));
    const tampered = receipt.token.replace(/^./, receipt.token[0] === 'a' ? 'b' : 'a');
    const ok = await suite().verify(
      keys.publicKey,
      b64ToBytes(receipt.sig_b64),
      ballotMessage(STAND_A, tampered)
    );
    expect(ok).toBe(false);
  });

  it('a forged signature (random bytes) does not verify', async () => {
    const junk = crypto.getRandomValues(new Uint8Array(256));
    const ok = await suite().verify(keys.publicKey, junk, ballotMessage(STAND_A, randomTokenHex()));
    expect(ok).toBe(false);
  });

  it('finalizeReceipt rejects a blind signature from the wrong key', async () => {
    const rogue = await RSABSSA.SHA384.generateKey({
      publicExponent: Uint8Array.from([1, 0, 1]),
      modulusLength: 2048,
    });
    const session = await blindForStand(keys.publicKey, STAND_A);
    // Signing with a foreign key may itself throw ("representative out of
    // range") depending on the rogue modulus — either way the receipt must
    // never be accepted, so assert over the whole attempt.
    const attempt = async () => {
      const rogueSig = await suite().blindSign(rogue.privateKey, b64ToBytes(session.blinded_b64));
      return finalizeReceipt(keys.publicKey, session, bytesToB64(rogueSig));
    };
    await expect(attempt()).rejects.toThrow();
  }, 60000);
});

describe('nullifier', () => {
  it('is deterministic for (stand, token) and 64 lowercase hex chars', async () => {
    const token = randomTokenHex();
    const n1 = await nullifierOf(STAND_A, token);
    const n2 = await nullifierOf(STAND_A, token);
    expect(n1).toBe(n2);
    expect(n1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs across stands for the same token (per-stand dedup, no cross-stand linkage)', async () => {
    const token = randomTokenHex();
    expect(await nullifierOf(STAND_A, token)).not.toBe(await nullifierOf(STAND_B, token));
  });
});

function b64ToBytes(s: string): Uint8Array {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

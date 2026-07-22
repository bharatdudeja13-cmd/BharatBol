/**
 * The registrar's PUBLIC key (RSA, for RFC 9474 blind signatures).
 *
 * Committed to the repo on purpose: anyone can verify that only
 * registrar-issued tokens can enter the public ballot log. Generate a
 * key pair with `node scripts/generate-registrar-key.mjs`, paste the
 * public JWK here, and put the private JWK ONLY in the Edge Function
 * secret REGISTRAR_PRIVATE_JWK — it must never appear in this repo.
 *
 * null = not configured yet (demo mode ignores it).
 */
export const REGISTRAR_PUBLIC_JWK: JsonWebKey | null = null;

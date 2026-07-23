/**
 * The ledger's PUBLIC signing key (ECDSA P-256).
 *
 * Committed on purpose: anyone can verify that a checkpoint in the Rekor
 * transparency log was signed by BharatBol. Generate with
 * `node scripts/generate-ledger-key.mjs`; keep the PRIVATE key only in the
 * GitHub Actions secret LEDGER_SIGNING_KEY.
 */
export const LEDGER_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEF7YnMIzhpLTq8ySUfT/tsXQp8icd
OJKsyKqPjj9aIjFA2O94GebM7TcSfhhKk+4RyqV7tq+JVxF32dkmFLPOcQ==
-----END PUBLIC KEY-----`;

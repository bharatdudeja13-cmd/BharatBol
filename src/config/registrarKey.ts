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
export const REGISTRAR_PUBLIC_JWK: JsonWebKey | null = {"key_ops":["verify"],"ext":true,"alg":"PS384","kty":"RSA","n":"t2Bj_zMSOSIPHZlfial5owf32kZTFNQ14CwQb4mwx92xmXEecGw2BbNbrSUBDPRB7jjXH1zybaIV2mKv3QuYqEbgnm743fKxwy97a_5XRTcgAxa7fLQF7_Sw0xDHzf1Q8-zdNuFFWemmwBbaVD-Af2XdjF_LmMEeGLidSZ7Kv0GxVzV7GWmoYyiHEXAwpR_Yw7JmyKXSrrAf1bJ5IONEx9pG_Qb2cryg6O1DrEePPBEFSS1q845Fe0BOhhnQLu_S3QKzPQ-EL3ryEIXtmiLPOhhVWObiRPQYg2qUjVTBTWbSqeSDhWnT--C4kQlZ5RnkK1ENAWrTghWVlA4p6CNblQ","e":"AQAB"};

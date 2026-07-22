import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Fail the production build when Supabase is not configured.
 *
 * VITE_* values are inlined by Vite at build time — Cloudflare *runtime*
 * Worker bindings / wrangler `vars` do not reach the client bundle. A missing
 * Build variable used to ship a silent "Configuration error" page; this gate
 * refuses to produce that bundle at all.
 *
 * `vite` (dev) is unaffected: local demo mode still works without .env.
 */
function assertSupabaseBuildEnv(): Plugin {
  return {
    name: 'assert-supabase-build-env',
    configResolved(config) {
      if (config.command !== 'build') return;
      const env = loadEnv(config.mode, config.envDir || process.cwd(), 'VITE_');
      const missing = (['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const).filter(
        (k) => !env[k]?.trim() && !process.env[k]?.trim(),
      );
      if (missing.length === 0) return;
      throw new Error(
        [
          `Production build refused: missing ${missing.join(', ')}.`,
          'Set them as Cloudflare Workers Builds → Variables → Build variables',
          '(not runtime bindings / wrangler vars), on both Production and Preview,',
          'then trigger a fresh deployment. Adding a variable does not rebuild.',
          'See docs/DEPLOY.md §2–§3.',
        ].join(' '),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), assertSupabaseBuildEnv()],
  build: { target: 'es2019' },
});

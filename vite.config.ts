import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Fail the production build when Supabase is not configured.
 *
 * VITE_* values are inlined by Vite at build time. Hosting runtime bindings
 * do not reach the client bundle. A missing
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
          'Set them as Vercel build environment variables',
          'on both Production and Preview,',
          'then trigger a fresh deployment. Adding a variable does not rebuild.',
          'See docs/DEPLOY.md.',
        ].join(' '),
      );
    },
  };
}

/**
 * Local stand-in for Worker `/api/ig-poster/:id` so Instagram thumbs work in
 * `npm run dev` without wrangler. Production uses worker/index.ts.
 */
function igPosterDevProxy(): Plugin {
  const SHORTCODE = /^[A-Za-z0-9_-]{5,64}$/;
  return {
    name: 'ig-poster-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const path = req.url?.split('?')[0] ?? '';
        const m = path.match(/^\/api\/ig-poster\/([^/]+)\/?$/);
        if (!m) return next();
        const id = decodeURIComponent(m[1]);
        if (!SHORTCODE.test(id)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        try {
          const upstream = await fetch(`https://www.instagram.com/p/${id}/media/?size=l`, {
            redirect: 'follow',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
              Accept: 'image/*,*/*',
            },
          });
          const ct = upstream.headers.get('content-type') ?? '';
          if (!upstream.ok || !ct.startsWith('image/')) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', ct);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.end(buf);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), assertSupabaseBuildEnv(), igPosterDevProxy()],
  build: { target: 'es2019' },
});

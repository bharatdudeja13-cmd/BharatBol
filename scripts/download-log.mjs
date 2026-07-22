#!/usr/bin/env node
/**
 * Download the full public ballot log as JSON-lines (one event per line),
 * suitable for archiving and for --file input to recount/checkpoint/
 * prove-inclusion. The log is public; only the anon/publishable key is used.
 *
 *   node scripts/download-log.mjs > ballot-log.jsonl
 */
import { envConfig, fetchLog } from './lib/log.mjs';

const { url, key } = envConfig();
if (!url || !key) {
  console.error('set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_ equivalents / .env)');
  process.exit(2);
}
for (const e of await fetchLog(url, key)) {
  console.log(JSON.stringify(e));
}

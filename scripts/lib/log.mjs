/**
 * Ballot-log access for the verification scripts: fetch the public log
 * from any BharatBol instance (anon key only — the log is public), or
 * read a local .jsonl copy. Also a minimal .env loader so the scripts
 * work out of the box in a checked-out repo.
 */
import { readFileSync, existsSync } from 'node:fs';

export function loadEnv(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env) && m[2]) process.env[m[1]] = m[2];
  }
}

export function envConfig() {
  loadEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return { url, key };
}

const PAGE = 1000;

/** Download the full log, ordered by seq — anyone can run this. */
export async function fetchLog(url, key) {
  const events = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(
      `${url}/rest/v1/ballot_log?select=seq,event,stand_id,nullifier,state,event_on&order=seq.asc`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Range: `${from}-${from + PAGE - 1}`,
        },
      }
    );
    if (!res.ok && res.status !== 206) {
      throw new Error(`log fetch failed: ${res.status} ${await res.text()}`);
    }
    const page = await res.json();
    events.push(...page);
    if (page.length < PAGE) break;
  }
  return events;
}

export function readLogFile(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

/** Shared CLI input: --file <log.jsonl> or the live instance from env. */
export async function loadLog(args) {
  const fileIdx = args.indexOf('--file');
  if (fileIdx >= 0) return readLogFile(args[fileIdx + 1]);
  const { url, key } = envConfig();
  if (!url || !key) {
    throw new Error(
      'No log source: pass --file <log.jsonl> or set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_ equivalents / .env).'
    );
  }
  return fetchLog(url, key);
}

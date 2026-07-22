import { useState } from 'react';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { supabase, isLive, REPO_URL } from '../lib/supabase';
import { fmt } from '../lib/format';
import { loadReceipts } from '../lib/blind';
// Shared verbatim with the CLI recount (scripts/recount.mjs) so the page
// and the terminal can never disagree about what the log says.
import { merkleRoot, replayCounts, type LogEvent } from '../../scripts/lib/merkle.mjs';

type Row = { standId: string; title: string; displayed: number; recount: number };
type Result = {
  size: number;
  root: string;
  rows: Row[];
  nationalDisplayed: number;
  nationalRecount: number;
  mine: { standId: string; title: string; found: boolean }[];
};

async function fetchFullLog(): Promise<LogEvent[]> {
  const events: LogEvent[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!
      .from('ballot_log')
      .select('seq,event,stand_id,nullifier,state,event_on')
      .order('seq', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    events.push(...((data ?? []) as LogEvent[]));
    if (!data || data.length < PAGE) break;
  }
  return events;
}

export default function Verify() {
  const { stands, counts, national } = useStands();
  const { t, lang } = useI18n();
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Result | null>(null);

  const titleOf = (id: string) => {
    const s = stands.find((x) => x.id === id);
    if (!s) return id;
    return lang === 'hi' && s.title_hi ? s.title_hi : s.title;
  };

  const run = async () => {
    if (!isLive) return;
    setState('running');
    try {
      const events = await fetchFullLog();
      const { stands: recounted, national: nationalRecount } = replayCounts(events);
      const root = await merkleRoot(events);
      const receipts = loadReceipts();
      const castNullifiers = new Set(
        events.filter((e) => e.event === 'cast').map((e) => e.nullifier)
      );
      setResult({
        size: events.length,
        root,
        rows: stands.map((s) => ({
          standId: s.id,
          title: titleOf(s.id),
          displayed: counts[s.id]?.total ?? 0,
          recount: recounted[s.id] ?? 0,
        })),
        nationalDisplayed: national,
        nationalRecount,
        mine: receipts.map((r) => ({
          standId: r.stand_id,
          title: titleOf(r.stand_id),
          found: castNullifiers.has(r.nullifier),
        })),
      });
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-10 leading-relaxed">
      <header>
        <h1 className="font-display font-bold text-3xl text-navy">{t('verify.title')}</h1>
        <p className="mt-3 text-sub">{t('verify.intro')}</p>
      </header>

      {!isLive ? (
        <p className="card p-5 text-sm text-saffron font-medium">{t('verify.demo')}</p>
      ) : (
        <section className="space-y-4">
          <button className="btn-primary" onClick={() => void run()} disabled={state === 'running'}>
            {state === 'running' ? t('verify.running') : t('verify.run')}
          </button>

          {state === 'error' && <p className="text-sm text-saffron">{t('misc.error')}</p>}

          {state === 'done' && result && (
            <div className="card p-5 space-y-4">
              <ul className="divide-y divide-line">
                {result.rows.map((r) => {
                  const ok = r.displayed === r.recount;
                  return (
                    <li key={r.standId} className="py-3 flex items-start justify-between gap-4 text-sm">
                      <span className="font-medium">{r.title}</span>
                      <span className={`font-mono shrink-0 ${ok ? 'text-green' : 'text-saffron font-bold'}`}>
                        {ok
                          ? `✓ ${fmt(r.recount)} ${t('verify.match')}`
                          : `✗ ${t('verify.mismatch')}: ${t('verify.displayed')} ${fmt(r.displayed)} / ${t('verify.recount')} ${fmt(r.recount)}`}
                      </span>
                    </li>
                  );
                })}
                <li className="py-3 flex items-start justify-between gap-4 text-sm font-semibold">
                  <span>{t('counts.taken')}</span>
                  <span
                    className={`font-mono shrink-0 ${
                      result.nationalDisplayed === result.nationalRecount ? 'text-green' : 'text-saffron'
                    }`}
                  >
                    {result.nationalDisplayed === result.nationalRecount
                      ? `✓ ${fmt(result.nationalRecount)} ${t('verify.match')}`
                      : `✗ ${t('verify.mismatch')}: ${fmt(result.nationalDisplayed)} / ${fmt(result.nationalRecount)}`}
                  </span>
                </li>
              </ul>
              <p className="text-xs text-sub font-mono break-all">
                {t('verify.root')} ({fmt(result.size)} {t('verify.events')}):
                <br />
                {result.root}
              </p>

              <div>
                <h2 className="font-display font-semibold text-lg">{t('verify.mine')}</h2>
                {result.mine.length === 0 ? (
                  <p className="text-sm text-sub mt-2">{t('verify.mineNone')}</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {result.mine.map((m) => (
                      <li key={m.standId} className="flex items-start justify-between gap-4">
                        <span>{m.title}</span>
                        <span className={`font-mono shrink-0 ${m.found ? 'text-green' : 'text-sub'}`}>
                          {m.found ? `✓ ${t('verify.found')}` : t('verify.notFound')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <p className="text-sub text-sm">{t('verify.checkpoints')}</p>
        <h2 className="font-display font-semibold text-xl">{t('verify.diy')}</h2>
        <pre className="card p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`git clone ${REPO_URL}
cd BharatBol && npm install
node scripts/download-log.mjs > ballot-log.jsonl
node scripts/recount.mjs --file ballot-log.jsonl
node scripts/prove-inclusion.mjs <your-nullifier> --file ballot-log.jsonl`}
        </pre>
        <p className="text-xs text-sub">
          <a href={`${REPO_URL}/tree/main/checkpoints`} target="_blank" rel="noreferrer" className="text-navy underline underline-offset-4">
            checkpoints/roots.jsonl
          </a>
        </p>
      </section>

      <section className="card p-5 text-sm text-sub">{t('disclaimer')}</section>
    </div>
  );
}

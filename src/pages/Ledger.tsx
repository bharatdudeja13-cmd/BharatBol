import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { isLive, REPO_URL, supabase } from '../lib/supabase';
import { fmt } from '../lib/format';
// Shared verbatim with the recount + Rekor signer, so page and CLI agree
// on what an entry / checkpoint hashes to.
import { canonicalEntry, entryHash, eventOf, replayLedger } from '../../scripts/lib/ledger.mjs';
import { merkleRoot } from '../../scripts/lib/merkle.mjs';
// Committed, Rekor-signed checkpoints (bundled at build; refreshed on redeploy).
import checkpointsRaw from '../../checkpoints/roots.jsonl?raw';

type PulseEntry = { id: number; stand_id: string; delta: number; at: string };
type Checkpoint = {
  size: number;
  root: string;
  rekor_index?: number;
  rekor_url?: string;
  signed_at?: string;
};

const CHECKPOINTS: Checkpoint[] = String(checkpointsRaw)
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));
const LATEST = CHECKPOINTS[CHECKPOINTS.length - 1] as Checkpoint | undefined;

// Anonymous sample for demo mode — no user identity, exact-time entries.
const DEMO_PULSE: PulseEntry[] = [
  { id: 3, stand_id: 'a1000001-0000-4000-8000-00000000000e', delta: 1, at: '2026-07-23T05:12:41.000Z' },
  { id: 2, stand_id: 'a1000002-0000-4000-8000-00000000000f', delta: 1, at: '2026-07-22T18:03:09.000Z' },
  { id: 1, stand_id: 'a1000001-0000-4000-8000-00000000000e', delta: -1, at: '2026-07-22T10:41:55.000Z' },
];

export default function Ledger() {
  const { stands } = useStands();
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<PulseEntry[]>([]);
  const [hashes, setHashes] = useState<Record<number, string>>({});
  const [liveRoot, setLiveRoot] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const titleOf = (id: string) => {
    const s = stands.find((x) => x.id === id);
    if (!s) return id.slice(0, 8);
    return lang === 'hi' && s.title_hi ? s.title_hi : s.title;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let rows: PulseEntry[];
      if (!supabase) {
        rows = DEMO_PULSE;
      } else {
        const { data } = await supabase
          .from('stand_pulse')
          .select('id,stand_id,delta,at') // anonymous columns only — never stand_commitments
          .order('id', { ascending: false })
          .limit(500);
        rows = (data as PulseEntry[]) ?? [];
      }
      if (cancelled) return;
      setEntries(rows);
      const asc = [...rows].sort((a, b) => a.id - b.id);
      const [root, hashPairs] = await Promise.all([
        asc.length ? merkleRoot(asc.map((e) => ({ __canon: canonicalEntry(e) }))) : Promise.resolve('0'.repeat(64)),
        Promise.all(rows.map(async (e) => [e.id, await entryHash(e)] as const)),
      ]);
      if (cancelled) return;
      setLiveRoot(root as string);
      setHashes(Object.fromEntries(hashPairs));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(() => replayLedger(entries).total, [entries]);

  const downloadLog = () => {
    const jsonl = [...entries]
      .sort((a, b) => a.id - b.id)
      .map((e) => JSON.stringify(e))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([jsonl], { type: 'application/x-ndjson' }));
    a.download = 'bharatbol-stand-ledger.jsonl';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rootMatches = LATEST && liveRoot && entries.length === LATEST.size && liveRoot === LATEST.root;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-8 leading-relaxed">
      <header>
        <h1 className="font-display font-bold text-3xl text-navy">{t('plog.title')}</h1>
        <p className="mt-3 text-sub">{t('plog.intro')}</p>
      </header>

      {!isLive && <p className="card p-4 text-sm text-saffron font-medium">{t('plog.demo')}</p>}

      {/* Signed checkpoint */}
      <section className="card p-5 space-y-2">
        <h2 className="font-display font-semibold text-lg">{t('plog.checkpoint')}</h2>
        {LATEST ? (
          <>
            <p className="text-sm text-sub">
              {t('plog.root')}: <span className="font-mono break-all text-ink">{LATEST.root}</span>
            </p>
            <p className="text-sm text-sub">
              {t('plog.size')}: <span className="font-mono">{fmt(LATEST.size)}</span>
            </p>
            {LATEST.rekor_url && (
              <a href={LATEST.rekor_url} target="_blank" rel="noreferrer" className="text-sm text-navy underline underline-offset-4 break-all">
                {t('plog.rekor')} {LATEST.rekor_index ? `#${LATEST.rekor_index}` : ''}
              </a>
            )}
            {liveRoot && (
              <p className="text-xs text-sub pt-1">
                {t('plog.live')}: <span className="font-mono break-all">{liveRoot.slice(0, 24)}…</span>{' '}
                {rootMatches ? (
                  <span className="text-green font-semibold">✓ {t('plog.match')}</span>
                ) : (
                  <span className="text-saffron font-semibold">· {t('plog.ahead')}</span>
                )}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-sub">{t('plog.noCheckpoint')}</p>
        )}
      </section>

      {/* Total */}
      <section>
        <p className="text-sm text-sub">{t('plog.total')}</p>
        <p className="font-display font-bold text-4xl text-navy tabular-nums">{fmt(total)}</p>
        <p className="text-xs text-sub mt-1 font-mono">{t('counts.verified')}</p>
      </section>

      {/* Entries */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-lg">{t('plog.entries')}</h2>
          <button className="btn-secondary text-xs !py-1.5 !px-3" onClick={downloadLog} disabled={entries.length === 0}>
            {t('plog.download')}
          </button>
        </div>
        {loading ? (
          <p className="text-sub text-sm">{t('misc.loading')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    <span className="font-mono text-sub">#{e.id}</span> ·{' '}
                    <span className={eventOf(e.delta) === 'stood' ? 'text-green' : 'text-saffron'}>
                      {t(`plog.event.${eventOf(e.delta)}` as 'plog.title')}
                    </span>{' '}
                    · {titleOf(e.stand_id)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-sub font-mono">
                  <span>{t('plog.time')}: {new Date(e.at).toISOString().replace('T', ' ').slice(0, 19)}Z</span>
                  <span className="break-all">{t('plog.hash')}: {(hashes[e.id] ?? '').slice(0, 16)}…</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Verify it yourself */}
      <section className="space-y-2">
        <h2 className="font-display font-semibold text-lg">{t('plog.recount')}</h2>
        <pre className="card p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`git clone ${REPO_URL}
cd BharatBol && npm install
node scripts/recount-ledger.mjs        # reproduce the totals + verify checkpoints`}
        </pre>
        <p className="text-xs">
          <a href={`${REPO_URL}/tree/main/checkpoints`} target="_blank" rel="noreferrer" className="text-navy underline underline-offset-4">
            checkpoints/roots.jsonl
          </a>
        </p>
      </section>

      {/* Honest framing */}
      <section className="card p-5 space-y-2">
        <h2 className="font-display font-semibold text-lg">{t('plog.provesTitle')}</h2>
        <p className="text-sm text-sub">{t('plog.proves')}</p>
        <p className="text-sm text-sub">{t('plog.provesNot')}</p>
      </section>

      <p className="text-sm">
        <Link to="/" className="text-navy underline underline-offset-4">← {t('app.name')}</Link>
      </p>
      <section className="card p-5 text-sm text-sub">{t('disclaimer')}</section>
    </div>
  );
}

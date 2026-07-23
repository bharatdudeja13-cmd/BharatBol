import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { isLive, REPO_URL } from '../lib/supabase';
import { fmt } from '../lib/format';

/**
 * Verify - public recount of stand_counts (anon-readable aggregates).
 * Optional signed-in section lists this account's stands only.
 */
export default function Verify() {
  const { session, signIn } = useAuth();
  const { stands, counts, national, joined } = useStands();
  const { t, lang } = useI18n();
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [rows, setRows] = useState<
    { standId: string; title: string; displayed: number; recount: number }[]
  >([]);
  const [nationalRecount, setNationalRecount] = useState(0);

  const titleOf = (id: string) => {
    const s = stands.find((x) => x.id === id);
    if (!s) return id;
    return lang === 'hi' && s.title_hi ? s.title_hi : s.title;
  };

  const run = async () => {
    if (!isLive) return;
    setState('running');
    try {
      const { supabase } = await import('../lib/supabase');
      // Public aggregate view - granted to anon; no session required.
      const { data, error } = await supabase!.from('stand_counts').select('stand_id,total');
      if (error) throw error;
      const byId: Record<string, number> = {};
      let nat = 0;
      for (const r of data ?? []) {
        byId[r.stand_id as string] = Number(r.total);
        nat += Number(r.total);
      }
      setNationalRecount(nat);
      setRows(
        stands.map((s) => ({
          standId: s.id,
          title: titleOf(s.id),
          displayed: counts[s.id]?.total ?? 0,
          recount: byId[s.id] ?? 0,
        }))
      );
      setState('done');
    } catch {
      setState('error');
    }
  };

  if (!isLive) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-16 text-center">
        <p className="text-sub">{t('verify.demo')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-8">
      <header>
        <h1 className="font-display font-bold text-3xl text-navy">{t('verify.title')}</h1>
        <p className="text-sub mt-2">{t('verify.publicMode')}</p>
      </header>

      <section className="space-y-4">
        <button className="btn-primary" onClick={() => void run()} disabled={state === 'running'}>
          {state === 'running' ? t('misc.loading') : t('verify.run')}
        </button>

        {state === 'error' && <p className="text-saffron text-sm">{t('misc.error')}</p>}

        {state === 'done' && (
          <div className="space-y-4">
            <p className="text-sm text-sub">
              {t('counts.taken')}: {fmt(national)} → recount {fmt(nationalRecount)}
              {national === nationalRecount ? ' ✓' : ''}
            </p>
            <ul className="card divide-y divide-line">
              {rows.map((r) => (
                <li key={r.standId} className="p-4 flex justify-between gap-4 text-sm">
                  <Link to={`/stand/${r.standId}`} className="text-navy underline underline-offset-4">
                    {r.title}
                  </Link>
                  <span className="font-mono tabular-nums shrink-0">
                    {fmt(r.displayed)} / {fmt(r.recount)}
                    {r.displayed === r.recount ? ' ✓' : ' ✗'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">{t('verify.mine')}</h2>
        <p className="text-sm text-sub">{t('verify.mineHint')}</p>
        {!session ? (
          <button className="btn-secondary text-sm" onClick={() => void signIn()}>
            {t('nav.signIn')}
          </button>
        ) : joined.size === 0 ? (
          <p className="text-sm text-sub">{t('verify.mineNoneAccount')}</p>
        ) : (
          <ul className="space-y-2">
            {[...joined].map((id) => (
              <li key={id}>
                <Link to={`/stand/${id}`} className="text-navy underline underline-offset-4 text-sm">
                  {titleOf(id)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-sub">
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          {t('about.openSource')}
        </a>
      </p>
    </div>
  );
}

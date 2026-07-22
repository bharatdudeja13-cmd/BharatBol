import { Link } from 'react-router-dom';
import type { Stand } from '../lib/types';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { LiveNumber } from './LiveNumber';
import { fmt } from '../lib/format';
import { stateName } from '../lib/states';

export function StandCard({ stand, compact = false }: { stand: Stand; compact?: boolean }) {
  const { counts, joined, requestStand, standStates } = useStands();
  const { t, lang } = useI18n();
  const c = counts[stand.id] ?? { total: 0, today: 0 };
  const title = lang === 'hi' && stand.title_hi ? stand.title_hi : stand.title;
  const desc = lang === 'hi' && stand.description_hi ? stand.description_hi : stand.description;
  const isJoined = joined.has(stand.id);
  const tags = standStates[stand.id] ?? [];

  return (
    <article className={`card p-5 flex flex-col gap-3 ${compact ? 'w-72 shrink-0' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-sub">
        <span className="inline-flex items-center gap-1.5 text-green">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" aria-hidden="true" />
          {t('stand.live')}
        </span>
        <span aria-hidden="true">·</span>
        <span className="uppercase tracking-wide">{stand.category}</span>
        <span aria-hidden="true">·</span>
        {tags.length === 0 ? (
          <span className="text-navy">{t('stands.national')}</span>
        ) : (
          <span className="text-saffron">
            {tags.map((code) => stateName(code, lang)).join(' · ')}
          </span>
        )}
      </div>

      <Link to={`/stand/${stand.id}`} className="group">
        <h3 className={`font-display font-semibold leading-snug group-hover:text-navy ${compact ? 'text-base line-clamp-2' : 'text-lg'}`}>
          {title}
        </h3>
      </Link>

      {!compact && <p className="text-sm text-sub leading-relaxed line-clamp-2">{desc}</p>}

      <div className="mt-auto flex items-end justify-between gap-3 pt-1">
        <div>
          <LiveNumber value={c.total} className="font-display font-bold text-2xl text-navy tabular-nums" />
          <div className="text-xs text-sub">
            {t('counts.standing')}
            {c.today > 0 && (
              <span className="text-green font-semibold"> · +{fmt(c.today)} {t('counts.today')}</span>
            )}
          </div>
        </div>
        <button
          className={isJoined ? 'btn-secondary text-sm !py-2 !px-4' : 'btn-primary text-sm !py-2 !px-4'}
          onClick={() => void requestStand(stand)}
        >
          {isJoined ? '✓ ' + t('stand.standing') : t('stand.standWith')}
        </button>
      </div>
    </article>
  );
}

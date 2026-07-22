import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { StandCard } from '../components/StandCard';

export default function Stands() {
  const { stands, loading } = useStands();
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10">
      <h1 className="font-display font-bold text-3xl text-navy">{t('nav.stands')}</h1>
      <p className="text-sub mt-2 max-w-xl">{t('app.sub')}</p>
      {loading ? (
        <p className="mt-10 text-sub">{t('misc.loading')}</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {stands.map((s) => (
            <StandCard key={s.id} stand={s} />
          ))}
        </div>
      )}
    </div>
  );
}

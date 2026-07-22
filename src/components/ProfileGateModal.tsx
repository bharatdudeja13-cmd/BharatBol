import { useEffect, useRef, useState } from 'react';
import { useStands } from '../state/StandsProvider';
import { useAuth } from '../state/AuthProvider';
import { useI18n } from '../lib/i18n';
import { STATES } from '../lib/states';

/**
 * Shown once, before a user's first stand, to collect the minimum:
 * first name + state, and wall consent. Nothing else is ever asked.
 */
export function ProfileGateModal() {
  const { profileGate, resolveProfileGate } = useStands();
  const { profile, saveProfile } = useAuth();
  const { t, lang } = useI18n();
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [onWall, setOnWall] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profileGate) {
      setName(profile?.first_name ?? '');
      setState(profile?.state ?? '');
      setOnWall(profile?.show_on_wall ?? true);
      setError(false);
      ref.current?.querySelector('input')?.focus();
    }
  }, [profileGate, profile]);

  if (!profileGate) return null;

  const submit = async () => {
    if (!name.trim() || !state) return;
    setBusy(true);
    setError(false);
    try {
      await saveProfile({ first_name: name.trim(), state, show_on_wall: onWall });
      await resolveProfileGate(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-navyDeep/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      onClick={(e) => e.target === e.currentTarget && void resolveProfileGate(false)}
    >
      <div ref={ref} className="card w-full max-w-md p-6 space-y-5">
        <div>
          <h2 id="gate-title" className="font-display font-semibold text-xl">
            {t('join.title')}
          </h2>
          <p className="text-sm text-sub mt-1">{t('join.privacy')}</p>
        </div>

        <label className="block">
          <span className="text-sm font-semibold">{t('join.name')}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="mt-1.5 w-full rounded-xl border border-line bg-faint px-4 py-3 text-base focus:border-navy"
            autoComplete="given-name"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">{t('join.state')}</span>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-faint px-4 py-3 text-base focus:border-navy"
          >
            <option value="" disabled>
              {t('join.statePlaceholder')}
            </option>
            {[...STATES]
              .sort((a, b) => (lang === 'hi' ? a.hi.localeCompare(b.hi, 'hi') : a.name.localeCompare(b.name)))
              .map((s) => (
                <option key={s.code} value={s.code}>
                  {lang === 'hi' ? s.hi : s.name}
                </option>
              ))}
          </select>
        </label>

        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={onWall}
            onChange={(e) => setOnWall(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[#15305E]"
          />
          <span>{t('join.wall')}</span>
        </label>

        {error && <p className="text-sm text-saffron">{t('misc.error')}</p>}

        <div className="flex gap-3 pt-1">
          <button className="btn-ghost flex-1" onClick={() => void resolveProfileGate(false)} disabled={busy}>
            {t('join.cancel')}
          </button>
          <button className="btn-primary flex-1" onClick={() => void submit()} disabled={busy || !name.trim() || !state}>
            {t('join.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

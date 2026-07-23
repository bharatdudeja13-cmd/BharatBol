import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { STATES, stateName } from '../lib/states';
import { isLive, SITE_URL } from '../lib/supabase';
import { drawCitizenCard, shareCanvas, downloadCanvas } from '../lib/cards';

export default function Me() {
  const { session, profile, saveProfile, deleteAccount, signIn } = useAuth();
  const { stands, joined, withdraw, withdrawAll, syncWall } = useStands();
  const { t, lang } = useI18n();

  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [onWall, setOnWall] = useState(true);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cardUrl, setCardUrl] = useState('');
  const [cardCanvas, setCardCanvas] = useState<HTMLCanvasElement | null>(null);
  const [showAllStands, setShowAllStands] = useState(false);

  useEffect(() => {
    setName(profile?.first_name ?? '');
    setState(profile?.state ?? '');
    setOnWall(profile?.show_on_wall ?? true);
  }, [profile]);

  const myStands = stands.filter((s) => joined.has(s.id));
  const STAND_PREVIEW = 5;
  const visibleStands = showAllStands ? myStands : myStands.slice(0, STAND_PREVIEW);
  const hiddenStandCount = Math.max(0, myStands.length - STAND_PREVIEW);

  useEffect(() => {
    const first = profile?.first_name || name;
    if (!first || myStands.length === 0) {
      setCardUrl('');
      setCardCanvas(null);
      return;
    }
    let cancelled = false;
    void drawCitizenCard({
      firstName: first,
      stateName: stateName(profile?.state, lang),
      titles: myStands.map((s) => s.title),
      url: SITE_URL,
    }).then((c) => {
      if (cancelled) return;
      setCardCanvas(c);
      setCardUrl(c.toDataURL('image/png'));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, joined.size, lang]);

  if (isLive && !session) {
    return (
      <div className="mx-auto max-w-md px-4 pt-20 text-center space-y-6">
        <p className="text-sub">{t('profile.signInFirst')}</p>
        <button className="btn-primary" onClick={() => void signIn()}>
          {t('nav.signIn')}
        </button>
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      const next = await saveProfile({ first_name: name.trim(), state: state || null, show_on_wall: onWall });
      if (next?.show_on_wall) await syncWall(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-12">
      <section>
        <h1 className="font-display font-bold text-3xl text-navy">{t('profile.title')}</h1>
        <div className="card mt-6 p-6 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold">{t('profile.firstName')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="mt-1.5 w-full rounded-xl border border-line bg-faint px-4 py-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">{t('profile.state')}</span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-faint px-4 py-3"
            >
              <option value="">{t('join.statePlaceholder')}</option>
              {STATES.map((s) => (
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
            <span>{t('profile.showOnWall')}</span>
          </label>
          <button className="btn-primary" onClick={() => void save()} disabled={busy || !name.trim()}>
            {saved ? '✓ ' + t('profile.saved') : t('profile.save')}
          </button>
        </div>
      </section>

      {cardUrl && (
        <section>
          <h2 className="font-display font-semibold text-2xl">{t('citizen.title')}</h2>
          <img src={cardUrl} alt={`${name} ${t('citizen.standsWith')}`} className="mt-4 w-full max-w-sm rounded-xl shadow-lift" />
          <div className="mt-4 flex gap-3">
            <button
              className="btn-primary text-sm"
              onClick={() =>
                cardCanvas &&
                void shareCanvas(cardCanvas, `${name} ${t('citizen.standsWith')} - BharatBol`, SITE_URL).then(
                  (ok) => !ok && downloadCanvas(cardCanvas, 'bharatbol-citizen-card.png')
                )
              }
            >
              {t('share.button')}
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={() => cardCanvas && downloadCanvas(cardCanvas, 'bharatbol-citizen-card.png')}
            >
              {t('share.download')}
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={() =>
                void drawCitizenCard({
                  firstName: profile?.first_name || name,
                  stateName: stateName(profile?.state, lang),
                  titles: myStands.map((s) => s.title),
                  url: SITE_URL,
                  format: 'story',
                }).then((c) => downloadCanvas(c, 'bharatbol-citizen-story.png'))
              }
            >
              {t('share.formatStory')}
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display font-semibold text-2xl">{t('profile.myStands')}</h2>
        {myStands.length === 0 ? (
          <p className="mt-3 text-sub">
            {t('profile.none')}{' '}
            <Link to="/stands" className="text-navy underline underline-offset-4">
              {t('stand.seeAll')}
            </Link>
          </p>
        ) : (
          <div className="mt-4 card overflow-hidden">
            <ul className="divide-y divide-line max-h-[22rem] overflow-y-auto">
              {visibleStands.map((s) => (
                <li key={s.id} className="p-4 flex items-center justify-between gap-4">
                  <Link
                    to={`/stand/${s.id}`}
                    className="font-medium text-sm hover:text-navy line-clamp-2 min-w-0"
                  >
                    {lang === 'hi' && s.title_hi ? s.title_hi : s.title}
                  </Link>
                  <button
                    className="text-xs text-sub underline underline-offset-4 hover:text-navy shrink-0"
                    onClick={() => void withdraw(s.id)}
                  >
                    {t('stand.withdraw')}
                  </button>
                </li>
              ))}
            </ul>
            {hiddenStandCount > 0 && (
              <button
                type="button"
                className="w-full border-t border-line px-4 py-3 text-sm font-semibold text-navy hover:bg-faint"
                onClick={() => setShowAllStands((v) => !v)}
              >
                {showAllStands
                  ? t('citizen.showLess')
                  : t('citizen.andMore').replace('{n}', String(hiddenStandCount))}
                {!showAllStands ? ` · ${t('citizen.showAll')}` : ''}
              </button>
            )}
          </div>
        )}
      </section>

      {isLive && (
        <section className="card p-6 border-saffron/40">
          <h2 className="font-display font-semibold text-lg text-ink">{t('profile.delete')}</h2>
          <p className="mt-2 text-sm text-sub leading-relaxed">{t('profile.deleteWarn')}</p>
          {confirmDelete ? (
            <div className="mt-4 flex gap-3">
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>
                {t('join.cancel')}
              </button>
              <button
                className="btn-primary !bg-saffron hover:!bg-saffron/90"
                onClick={() =>
                  void (async () => {
                    await withdrawAll();
                    await deleteAccount();
                  })()
                }
              >
                {t('profile.deleteConfirm')}
              </button>
            </div>
          ) : (
            <button className="btn-secondary mt-4 text-sm" onClick={() => setConfirmDelete(true)}>
              {t('profile.delete')}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

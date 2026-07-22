import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { LANG_OPTIONS, langButtonLabel, type LangCode } from '../config/languages';

/** Language button + sheet picker. Persists via LangProvider / localStorage. */
export function LanguageSelector() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (code: LangCode) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="btn-ghost text-sm font-mono px-3 min-w-[2.75rem]"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('lang.choose')}
      >
        {langButtonLabel(lang)}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-navyDeep/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lang-picker-title"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            ref={panelRef}
            className="card w-full max-w-md max-h-[min(80vh,36rem)] flex flex-col overflow-hidden shadow-lift"
          >
            <div className="px-5 pt-5 pb-3 border-b border-line flex items-center justify-between gap-3">
              <h2 id="lang-picker-title" className="font-display font-semibold text-lg text-navy">
                {t('lang.choose')}
              </h2>
              <button type="button" className="btn-ghost text-sm" onClick={() => setOpen(false)}>
                {t('join.cancel')}
              </button>
            </div>
            <p className="px-5 pt-3 text-xs text-sub">{t('lang.fallbackNote')}</p>
            <ul className="flex-1 overflow-y-auto p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {LANG_OPTIONS.map((opt) => {
                const active = opt.code === lang;
                return (
                  <li key={opt.code}>
                    <button
                      type="button"
                      onClick={() => pick(opt.code)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left min-h-12 transition ${
                        active ? 'bg-navy text-white' : 'hover:bg-faint text-ink'
                      }`}
                    >
                      <span className="font-semibold">{opt.native}</span>
                      <span className={`text-xs font-mono ${active ? 'text-white/70' : 'text-sub'}`}>
                        {opt.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

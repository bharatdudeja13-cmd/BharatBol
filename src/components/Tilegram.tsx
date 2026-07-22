import { STATES, INTENSITY, intensityBucket, stateName } from '../lib/states';
import { fmt } from '../lib/format';
import { useI18n } from '../lib/i18n';

/**
 * India as a 9×9 grid of rounded state tiles, shaded by how many
 * citizens are standing in each state.
 */
export function Tilegram({
  countsByState,
  selected,
  onSelect,
}: {
  countsByState: Record<string, number>;
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const { lang } = useI18n();
  const max = Math.max(0, ...Object.values(countsByState));

  return (
    <div
      className="grid gap-1.5 mx-auto w-full max-w-md"
      style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}
      role="listbox"
      aria-label={lang === 'hi' ? 'भारत का राज्य-मानचित्र' : 'India state map'}
    >
      {STATES.map((s) => {
        const count = countsByState[s.code] ?? 0;
        const bucket = intensityBucket(count, max);
        const isSel = selected === s.code;
        return (
          <button
            key={s.code}
            role="option"
            aria-selected={isSel}
            aria-label={`${stateName(s.code, lang)}: ${fmt(count)}`}
            title={`${stateName(s.code, lang)} — ${fmt(count)}`}
            onClick={() => onSelect(isSel ? null : s.code)}
            className={`aspect-square rounded-lg text-[10px] sm:text-xs font-mono font-semibold transition
              flex items-center justify-center select-none
              ${bucket >= 2 ? 'text-white' : 'text-ink/70'}
              ${isSel ? 'ring-[3px] ring-saffron ring-offset-1' : 'hover:ring-2 hover:ring-navy/30'}`}
            style={{
              gridColumnStart: s.col + 1,
              gridRowStart: s.row + 1,
              backgroundColor: INTENSITY[bucket],
            }}
          >
            {s.code}
          </button>
        );
      })}
    </div>
  );
}

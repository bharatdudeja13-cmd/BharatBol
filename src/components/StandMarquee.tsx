import { useRef, useState } from 'react';
import type { Stand } from '../lib/types';
import { StandCard } from './StandCard';
import { useI18n } from '../lib/i18n';

/** Auto-scrolling stand strip that stays finger-scrollable. */
export function StandMarquee({ stands }: { stands: Stand[] }) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<number | null>(null);

  const pause = () => {
    setPaused(true);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  };
  const scheduleResume = () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), 2500);
  };

  if (stands.length === 0) return null;

  const loop = [...stands, ...stands];

  return (
    <section
      className="marquee-scroll -mx-4 px-4 py-2 mt-12"
      aria-label={t('nav.stands')}
      onTouchStart={pause}
      onTouchEnd={scheduleResume}
      onMouseDown={pause}
      onMouseUp={scheduleResume}
      onMouseLeave={scheduleResume}
    >
      <div className={`marquee-track flex gap-4 w-max ${paused ? 'is-paused' : ''}`}>
        {loop.map((s, i) => (
          <StandCard key={`${s.id}-${i}`} stand={s} compact />
        ))}
      </div>
    </section>
  );
}

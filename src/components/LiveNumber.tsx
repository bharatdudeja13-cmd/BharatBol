import { useEffect, useRef, useState } from 'react';
import { fmt } from '../lib/format';

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A number that eases to its new value when the live count changes. */
export function LiveNumber({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced() || Math.abs(value - prev.current) < 2) {
      prev.current = value;
      setShown(value);
      return;
    }
    const from = prev.current;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return (
    <span className={className} aria-live="polite">
      {fmt(shown)}
    </span>
  );
}

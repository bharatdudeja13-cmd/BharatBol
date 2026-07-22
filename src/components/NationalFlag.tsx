import { AshokaChakra } from './AshokaChakra';
import { useI18n } from '../lib/i18n';

/**
 * A dignified waving tricolour for the home hero.
 *
 * Depiction rules (Flag Code of India — non-negotiable):
 *  - Band order is fixed: saffron top, white middle, green bottom.
 *  - Proportion is exactly 1:1:1 *everywhere*, by construction: each band
 *    lies between two congruent sine curves offset by exactly BAND, so its
 *    thickness is constant no matter where the wave is. The bands can
 *    never reorder, invert, or be squeezed relative to one another.
 *  - The Ashoka Chakra is the navy 24-spoke wheel, centred on the white
 *    band, turning slowly and continuously (24s = one spoke per second):
 *    the eternal wheel of law and of motion — never a fast spin.
 *  - Nothing is ever drawn on top of the flag.
 *
 * Implementation: one inline SVG, no library, no image asset. The cloth is
 * a three-period-wide group translated horizontally by a single GPU
 * transform, so the wave travels through the flag seamlessly at 60fps.
 * Under prefers-reduced-motion the animated cloth is replaced by a flat,
 * still tricolour (see index.css).
 */
const W = 300; // one wave period = the visible width
const BAND = 60;
const AMP = 7;
const H = AMP + BAND * 3 + AMP; // 194 — headroom so crests never clip
const REPEATS = 3;
const STEP = 5;

const wave = (x: number) => AMP + AMP * Math.sin((2 * Math.PI * x) / W);

/** Closed path for the band whose top edge sits `offset` below the crestline. */
function bandPath(offset: number): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let x = 0; x <= W * REPEATS; x += STEP) {
    top.push(`${x} ${(wave(x) + offset).toFixed(2)}`);
    bottom.push(`${x} ${(wave(x) + offset + BAND).toFixed(2)}`);
  }
  return `M ${top.join(' L ')} L ${bottom.reverse().join(' L ')} Z`;
}

const BANDS = [
  { d: bandPath(0), fill: '#FF9933' },
  { d: bandPath(BAND), fill: '#FFFFFF' },
  { d: bandPath(BAND * 2), fill: '#138808' },
];

export function NationalFlag({ className = '' }: { className?: string }) {
  const { t } = useI18n();

  return (
    <div className={`bb-flag ${className}`} role="img" aria-label={t('flag.alt')}>
      <svg
        className="bb-flag-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Fold shading: light and shadow only — never alters band colour. */}
          <linearGradient id="bb-fold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0F2347" stopOpacity="0.16" />
            <stop offset="18%" stopColor="#FFFFFF" stopOpacity="0.20" />
            <stop offset="38%" stopColor="#0F2347" stopOpacity="0.10" />
            <stop offset="58%" stopColor="#FFFFFF" stopOpacity="0.20" />
            <stop offset="80%" stopColor="#0F2347" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0F2347" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/* Animated cloth: three periods wide, translated by one period. */}
        <g className="bb-flag-cloth">
          {BANDS.map((b) => (
            <path key={b.fill} d={b.d} fill={b.fill} />
          ))}
          <rect x="0" y="0" width={W * REPEATS} height={H} fill="url(#bb-fold)" />
        </g>

        {/* Still tricolour for prefers-reduced-motion (CSS swaps them).
            Fills the whole box in exact thirds — no gaps, same 1:1:1. */}
        <g className="bb-flag-still">
          <rect x="0" y="0" width={W} height={H / 3} fill="#FF9933" />
          <rect x="0" y={H / 3} width={W} height={H / 3} fill="#FFFFFF" />
          <rect x="0" y={(H * 2) / 3} width={W} height={H / 3} fill="#138808" />
        </g>

        {/* Chakra rides the white band, centred, turning slowly. */}
        <g className="bb-flag-chakra" transform={`translate(${W / 2} ${AMP + BAND * 1.5})`}>
          <g className="bb-flag-chakra-spin">
            <g transform="translate(-24 -24)">
              <AshokaChakra size={48} color="#15305E" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

export function AshokaChakra({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1.6" />
      {spokes.map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="12"
          x2="12"
          y2="2.4"
          stroke={color}
          strokeWidth="0.8"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="1.8" fill={color} />
    </svg>
  );
}

/** The brand mark: white chakra in a navy rounded square. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl bg-navy text-white shrink-0"
      style={{ width: size, height: size }}
    >
      <AshokaChakra size={size * 0.62} color="#FFFFFF" />
    </span>
  );
}

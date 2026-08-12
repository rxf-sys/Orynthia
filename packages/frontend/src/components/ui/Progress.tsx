import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  color?: string;
  thin?: boolean;
  thick?: boolean;
  className?: string;
  label?: string;
  /**
   * Referenzmarke in Prozent, z. B. der erwartete Monatsverlauf. Ohne sie
   * ist „87 % verbraucht“ nicht interpretierbar – am 11. des Monats ist
   * das viel, am 28. wenig.
   */
  marker?: number;
  markerLabel?: string;
  /** Schraffur zusätzlich zur Farbe, wenn der Wert die Grenze reißt. */
  hatched?: boolean;
}

export function Progress({
  value,
  color,
  thin,
  thick,
  className,
  label,
  marker,
  markerLabel,
  hatched,
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const markerPos = marker === undefined ? undefined : Math.max(0, Math.min(100, marker));

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn('progress', thin && 'thin', thick && 'thick')}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Fortschritt'}
      >
        <span
          className={cn(hatched && 'hatched')}
          style={
            {
              width: `${clamped}%`,
              ...(color ? { background: color, '--s': color } : {}),
            } as React.CSSProperties
          }
        />
      </div>
      {markerPos !== undefined && (
        <span
          aria-hidden
          title={markerLabel}
          // Ragt oben und unten über den Balken hinaus, damit die Marke
          // nicht mit dem Balken selbst verschmilzt.
          className="pointer-events-none absolute -top-[3px] -bottom-[3px] w-0.5 rounded-pill"
          style={{ left: `${markerPos}%`, background: 'var(--text-2)' }}
        />
      )}
    </div>
  );
}

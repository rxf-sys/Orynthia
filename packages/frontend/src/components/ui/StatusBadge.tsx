import { STATUS_STYLE, type StatusKind } from '@/lib/status';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  kind: StatusKind;
  /** Überschreibt das Standardlabel, z. B. „Überfällig“ statt „Überzogen“. */
  label?: string;
  size?: 'sm' | 'md';
  /** Nur das Icon in getönter Fläche – für enge Listenzeilen. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Statusanzeige mit Farbe **und** Icon **und** Text.
 *
 * Nie nur Farbe: wer nicht zwischen Rot und Grün unterscheiden kann, muss
 * den Status trotzdem erkennen. Bei `iconOnly` trägt das Element deshalb
 * ein `aria-label` mit demselben Text.
 */
export function StatusBadge({ kind, label, size = 'md', iconOnly, className }: StatusBadgeProps) {
  const style = STATUS_STYLE[kind];
  const Icon = style.icon;
  const text = label ?? style.label;

  if (iconOnly) {
    return (
      <span
        role="img"
        aria-label={text}
        title={text}
        className={cn(
          'status-surface grid shrink-0 place-items-center rounded-md border',
          size === 'sm' ? 'h-[22px] w-[22px]' : 'h-[30px] w-[30px]',
          className,
        )}
        style={{ '--s': style.color } as React.CSSProperties}
      >
        <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'status-surface inline-flex shrink-0 items-center gap-1.5 rounded-pill border font-bold',
        size === 'sm' ? 'px-2 py-0.5 text-[0.66rem]' : 'px-2.5 py-1 text-[0.69rem]',
        className,
      )}
      style={{ '--s': style.color } as React.CSSProperties}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      {text}
    </span>
  );
}

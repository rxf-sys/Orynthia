import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  color?: string;
  thin?: boolean;
  thick?: boolean;
  className?: string;
  label?: string;
}

export function Progress({ value, color, thin, thick, className, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('progress', thin && 'thin', thick && 'thick', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Fortschritt'}
    >
      <span
        style={{
          width: `${clamped}%`,
          ...(color ? { background: color } : {}),
        }}
      />
    </div>
  );
}

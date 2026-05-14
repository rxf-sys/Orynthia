import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  color?: string;
  thin?: boolean;
  thick?: boolean;
  className?: string;
}

export function Progress({ value, color, thin, thick, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('progress', thin && 'thin', thick && 'thick', className)}>
      <span
        style={{
          width: `${clamped}%`,
          ...(color ? { background: color } : {}),
        }}
      />
    </div>
  );
}

import { cn } from '@/lib/utils';

interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-neg"> *</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

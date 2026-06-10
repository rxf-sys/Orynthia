import { cloneElement, isValidElement, useId } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Verknüpft Label, Hint und Fehlermeldung semantisch mit dem Eingabe-Element:
 * ein einzelnes Input/Select/Textarea-Kind bekommt automatisch id,
 * aria-describedby und aria-invalid.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  let control = children;
  if (isValidElement(children)) {
    const childProps = children.props as { id?: string };
    control = cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      id: childProps.id ?? id,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : undefined,
    });
  }

  const htmlFor = isValidElement(children) ? ((children.props as { id?: string }).id ?? id) : id;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="text-neg"> *</span>}
        </label>
      )}
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-neg">
          {error}
        </p>
      )}
    </div>
  );
}

import { cn } from '@/lib/utils';

type Variant = 'default' | 'pos' | 'neg' | 'warn' | 'info' | 'accent';

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  default: 'tag',
  pos: 'tag-pos',
  neg: 'tag-neg',
  warn: 'tag-warn',
  info: 'tag-info',
  accent: 'tag-accent',
};

export function Tag({ variant = 'default', className, children, ...rest }: TagProps) {
  return (
    <span className={cn(variants[variant], className)} {...rest}>
      {children}
    </span>
  );
}

import { cn } from '@/lib/utils';

type Variant = 'default' | 'soft' | 'flat' | 'hero';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  hover?: boolean;
}

const variants: Record<Variant, string> = {
  default: 'card',
  soft: 'card-soft',
  flat: 'card-flat',
  hero: 'card-hero',
};

export function Card({ variant = 'default', hover, className, children, ...rest }: CardProps) {
  return (
    <div className={cn(variants[variant], hover && 'card-hover', className)} {...rest}>
      {children}
    </div>
  );
}

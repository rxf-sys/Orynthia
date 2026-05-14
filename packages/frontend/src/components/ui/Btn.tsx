import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'accent' | 'grad' | 'ghost' | 'quiet' | 'danger';
type Size = 'sm' | 'md';

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

const variants: Record<Variant, string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  grad: 'btn-grad',
  ghost: 'btn-ghost',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
};

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(variants[variant], size === 'sm' && 'btn-sm', className)}
      {...rest}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
      {IconRight && <IconRight className="h-4 w-4" />}
    </button>
  );
});

interface IconBtnProps extends Omit<BtnProps, 'icon' | 'iconRight'> {
  icon: LucideIcon;
  'aria-label': string;
}

export const IconBtn = forwardRef<HTMLButtonElement, IconBtnProps>(function IconBtn(
  { variant = 'ghost', icon: Icon, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(variants[variant], 'btn-icon', className)}
      {...rest}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
});

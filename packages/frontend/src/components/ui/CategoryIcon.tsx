import { cn } from '@/lib/utils';
import { pickCategoryColor } from '@/lib/categoryColors';

interface CategoryLike {
  color?: string | null;
  icon?: string | null;
  name?: string | null;
}

interface CategoryIconProps {
  cat?: CategoryLike | null;
  size?: number;
  fallbackIcon?: string;
  className?: string;
}

export function CategoryIcon({ cat, size = 38, fallbackIcon = '💳', className }: CategoryIconProps) {
  const color = cat?.color || pickCategoryColor(cat?.name);
  return (
    <div
      className={cn('grid shrink-0 place-items-center rounded-md font-semibold', className)}
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        color,
        fontSize: Math.max(14, Math.floor(size * 0.42)),
      }}
      aria-hidden
    >
      {cat?.icon || fallbackIcon}
    </div>
  );
}

interface CategoryDotProps {
  cat?: CategoryLike | null;
  size?: number;
  className?: string;
}

export function CategoryDot({ cat, size = 10, className }: CategoryDotProps) {
  const color = cat?.color || pickCategoryColor(cat?.name);
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ width: size, height: size, background: color }}
      aria-hidden
    />
  );
}

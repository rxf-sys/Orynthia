import { cn } from '@/lib/utils';

interface AvatarProps {
  name?: string | null;
  size?: number;
  className?: string;
  color?: string;
}

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

export function Avatar({ name, size = 36, className, color }: AvatarProps) {
  return (
    <div
      className={cn('grid place-items-center rounded-full font-bold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.floor(size * 0.4)),
        background: color || 'linear-gradient(135deg, #424769, #ffb17a)',
        boxShadow: '0 0 0 2px var(--bg-elev), 0 4px 10px rgba(45,50,80,.18)',
        flex: '0 0 auto',
      }}
    >
      {initials(name)}
    </div>
  );
}

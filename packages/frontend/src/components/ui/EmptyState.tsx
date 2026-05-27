import { Card } from './Card';
import { Btn } from './Btn';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <Card
      className="text-center"
      style={{ padding: compact ? '32px 24px' : '56px 24px' }}
    >
      <Icon className="mx-auto mb-3 h-10 w-10 text-ink-4" />
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      {action && (
        <div className="mt-4 flex justify-center">
          <Btn variant="grad" icon={action.icon} onClick={action.onClick}>
            {action.label}
          </Btn>
        </div>
      )}
    </Card>
  );
}

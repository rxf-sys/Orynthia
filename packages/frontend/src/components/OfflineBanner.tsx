import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/platform/offline/useOnlineStatus';

/**
 * Sichtbarer Hinweis, dass gerade nur der zuletzt geladene Stand zu sehen
 * ist. Ohne diesen Hinweis wären veraltete Daten nicht von aktuellen zu
 * unterscheiden – bei Terminen und Aufgaben ein echtes Risiko.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="status-surface flex items-center justify-center gap-2 border-b px-3 py-[7px] text-center text-[0.78rem] font-semibold"
      style={{ '--s': 'var(--warn)' } as React.CSSProperties}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Offline — zuletzt geladener Stand. Änderungen sind gesperrt.</span>
    </div>
  );
}

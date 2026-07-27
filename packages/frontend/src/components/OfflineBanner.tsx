import { CloudOff } from 'lucide-react';
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
      className="flex items-center justify-center gap-2 border-b border-line bg-peach px-4 py-2 text-center text-xs font-semibold text-navy"
    >
      <CloudOff className="h-4 w-4 shrink-0" />
      <span>
        Offline – du siehst den zuletzt geladenen Stand. Änderungen sind erst wieder möglich, wenn
        die Verbindung steht.
      </span>
    </div>
  );
}

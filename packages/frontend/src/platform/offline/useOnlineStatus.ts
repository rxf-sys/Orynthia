import { useEffect, useState } from 'react';

/**
 * Verbindungsstatus des Browsers. `navigator.onLine` ist bewusst die
 * einzige Quelle: ein eigener Ping würde regelmäßig Traffic erzeugen und
 * wäre bei Captive Portals ebenso unzuverlässig.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

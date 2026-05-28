import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  TrendingDown,
  Repeat,
  Target,
  Sparkles,
  CloudOff,
  Info,
  Check,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { notificationsApi } from '@/lib/api';
import type { Notification, NotificationType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Btn } from './ui/Btn';

const ICON_MAP: Record<NotificationType, LucideIcon> = {
  BUDGET_WARNING: AlertTriangle,
  BUDGET_EXCEEDED: Target,
  LARGE_TRANSACTION: TrendingDown,
  RECURRING_DETECTED: Repeat,
  SAVINGS_MILESTONE: Sparkles,
  SYNC_ERROR: CloudOff,
  SYSTEM: Info,
};

const ACCENT_MAP: Record<NotificationType, string> = {
  BUDGET_WARNING: 'var(--warn)',
  BUDGET_EXCEEDED: 'var(--neg)',
  LARGE_TRANSACTION: 'var(--neg)',
  RECURRING_DETECTED: 'var(--indigo)',
  SAVINGS_MILESTONE: 'var(--pos)',
  SYNC_ERROR: 'var(--neg)',
  SYSTEM: 'var(--ink-3)',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationsApi.count().then((r) => r.data),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unread = countData?.count ?? 0;

  const { data: list = [], isFetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 30 }).then((r) => r.data),
    enabled: open,
    staleTime: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Benachrichtigungen${unread > 0 ? ` (${unread} ungelesen)` : ''}`}
        className="btn-ghost btn-icon relative"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[0.65rem] font-bold text-white"
            style={{ background: 'var(--neg)', boxShadow: '0 0 0 2px var(--bg-elev)' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-elev shadow-xl animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <div className="text-sm font-bold text-ink">Benachrichtigungen</div>
              <div className="text-xs text-ink-3">
                {unread > 0 ? `${unread} ungelesen` : 'Alles gelesen'}
              </div>
            </div>
            {unread > 0 && (
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                Alle gelesen
              </Btn>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isFetching && list.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-3">Lädt…</div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="h-7 w-7 text-ink-4" />
                <p className="text-sm font-semibold text-ink-2">Keine Benachrichtigungen</p>
                <p className="text-xs text-ink-3">
                  Du wirst hier informiert, wenn ein Budget knapp wird, eine wiederkehrende Zahlung
                  ansteht oder eine ungewöhnliche Buchung erkannt wird.
                </p>
              </div>
            ) : (
              <ul>
                {list.map((n: Notification) => {
                  const Icon = ICON_MAP[n.type] ?? Info;
                  const accent = ACCENT_MAP[n.type] ?? 'var(--ink-3)';
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        'group flex gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-soft',
                        !n.isRead && 'bg-soft/60',
                      )}
                    >
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
                        style={{ background: 'rgba(0,0,0,.04)', color: accent }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          <div className="flex-1 text-sm font-semibold text-ink">{n.title}</div>
                          {!n.isRead && (
                            <span
                              aria-hidden
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                              style={{ background: 'var(--indigo)' }}
                            />
                          )}
                        </div>
                        <div className="mt-0.5 text-xs leading-snug text-ink-2">{n.message}</div>
                        <div className="mt-1 flex items-center justify-between">
                          <div className="text-[0.68rem] text-ink-3">
                            {formatRelative(n.createdAt)}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            {!n.isRead && (
                              <button
                                onClick={() => markRead.mutate(n.id)}
                                className="rounded p-1 text-ink-3 hover:bg-bg hover:text-indigo"
                                aria-label="Als gelesen markieren"
                                title="Als gelesen markieren"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => remove.mutate(n.id)}
                              className="rounded p-1 text-ink-3 hover:bg-bg hover:text-neg"
                              aria-label="Benachrichtigung löschen"
                              title="Löschen"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `vor ${hr} Std.`;
  const days = Math.round(hr / 24);
  if (days < 7) return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
  return new Date(iso).toLocaleDateString('de-DE');
}

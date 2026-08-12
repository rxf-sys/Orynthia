import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { budgetsApi, contractsApi, dashboardApi } from '@/features/finance/api';
import { tasksApi } from '@/features/tasks/api';
import { documentsApi } from '@/features/documents/api';
import type { Budget, Contract } from '@/features/finance/types';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  FORECAST_BUFFER,
  STATUS_STYLE,
  budgetStatus,
  daysUntil,
  dueStatus,
  forecastStatus,
  type StatusKind,
} from '@/lib/status';

interface FocusItem {
  id: string;
  kind: StatusKind;
  title: string;
  reason: string;
  to: string;
  /** Höher = dringender. Bestimmt, welche drei Karten sichtbar sind. */
  weight: number;
}

const KIND_WEIGHT: Record<StatusKind, number> = { crit: 300, warn: 200, info: 100, ok: 0, idle: 0 };

/**
 * „Was heute zählt“ – die drei dringendsten offenen Statusmeldungen.
 *
 * Das Band ist datengetrieben: es zeigt nicht drei feste Karten, sondern
 * das, was aus den aktuellen Werten tatsächlich folgt. Ist nichts offen,
 * verschwindet es ganz, statt Platzhalter zu zeigen.
 */
export function FocusBand() {
  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsApi.getAll().then((r) => r.data),
  });
  const { data: tasks } = useQuery({
    queryKey: ['tasks-summary'],
    queryFn: () => tasksApi.getSummary().then((r) => r.data),
  });
  const { data: contracts } = useQuery({
    queryKey: ['contracts'],
    // Denselben Cache-Eintrag wie Contracts-Seite und Widget teilen: die
    // API liefert ein Objekt mit Summen, ausgepackt wird erst unten.
    queryFn: () => contractsApi.getAll().then((r) => r.data),
  });
  const { data: forecast } = useQuery({
    queryKey: ['forecast', 60],
    queryFn: () => dashboardApi.getForecast(60).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const { data: documents } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.getAll().then((r) => r.data),
  });

  const items = useMemo(() => {
    const out: FocusItem[] = [];
    const now = new Date();

    // Budgets: überzogene zuerst, dann knappe
    for (const b of (budgets ?? []) as Budget[]) {
      const kind = budgetStatus(b.percentage);
      if (kind === 'ok') continue;
      const name = b.category?.name ?? 'Budget';
      out.push({
        id: `budget-${b.id}`,
        kind,
        title: kind === 'crit' ? `${name} ist überzogen` : `${name} wird knapp`,
        reason: `${formatCurrency(b.spent)} von ${formatCurrency(b.amount)} — ${formatPercent(b.percentage)} verbraucht`,
        to: '/finance/budgets',
        weight: KIND_WEIGHT[kind] + Math.min(b.percentage, 999),
      });
    }

    // Aufgaben
    if (tasks?.overdue) {
      out.push({
        id: 'tasks-overdue',
        kind: 'crit',
        title: `${tasks.overdue} ${tasks.overdue === 1 ? 'Aufgabe' : 'Aufgaben'} überfällig`,
        reason: 'Fälligkeitsdatum liegt in der Vergangenheit',
        to: '/tasks',
        weight: KIND_WEIGHT.crit + 50 + tasks.overdue,
      });
    } else if (tasks?.dueToday) {
      out.push({
        id: 'tasks-today',
        kind: 'info',
        title: `${tasks.dueToday} ${tasks.dueToday === 1 ? 'Aufgabe' : 'Aufgaben'} heute fällig`,
        reason: 'Noch offen für heute',
        to: '/tasks',
        weight: KIND_WEIGHT.info + tasks.dueToday,
      });
    }

    // Liquidität: nur melden, wenn der Puffer wirklich gerissen wird
    if (forecast && forecast.lowestBalance < FORECAST_BUFFER) {
      const kind = forecastStatus(forecast.lowestBalance);
      out.push({
        id: 'forecast',
        kind,
        title:
          kind === 'crit' ? 'Liquidität wird negativ' : 'Liquidität fällt unter den Puffer',
        reason: `Tiefstwert ${formatCurrency(forecast.lowestBalance)} am ${new Date(
          forecast.lowestDate,
        ).toLocaleDateString('de-DE')}`,
        to: '/finance',
        weight: KIND_WEIGHT[kind] + 80,
      });
    }

    // Kündigungsfristen
    for (const c of (contracts?.contracts ?? []) as Contract[]) {
      if (!c.cancellationDate) continue;
      const days = daysUntil(new Date(c.cancellationDate), now);
      if (days < 0 || days > 30) continue;
      const kind = dueStatus(days);
      if (kind === 'ok') continue;
      out.push({
        id: `contract-${c.id}`,
        kind,
        title: `${c.name} kündbar bis ${new Date(c.cancellationDate).toLocaleDateString('de-DE')}`,
        reason: days === 0 ? 'Frist läuft heute ab' : `noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`,
        to: '/finance/contracts',
        weight: KIND_WEIGHT[kind] + (30 - days),
      });
    }

    // Ablaufende Dokumente
    for (const d of documents ?? []) {
      if (!d.expiresAt) continue;
      const days = daysUntil(new Date(d.expiresAt), now);
      if (days < 0 || days > 30) continue;
      out.push({
        id: `doc-${d.id}`,
        kind: 'warn',
        title: `${d.title} läuft ab`,
        reason: `gültig bis ${new Date(d.expiresAt).toLocaleDateString('de-DE')} — noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`,
        to: '/documents',
        weight: KIND_WEIGHT.warn + (30 - days),
      });
    }

    return out.sort((a, b) => b.weight - a.weight).slice(0, 3);
  }, [budgets, tasks, contracts, forecast, documents]);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="focus-heading">
      <SectionHead id="focus-heading" title="Was heute zählt" />
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr))]">
        {items.map((item) => {
          const style = STATUS_STYLE[item.kind];
          const Icon = style.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              className="flex items-start gap-3 rounded-[14px] border bg-elev p-4 transition-colors hover:bg-soft"
              style={{
                borderColor: style.line,
                borderLeft: `3px solid ${style.color}`,
              }}
            >
              <span
                aria-hidden
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px]"
                style={{ background: style.tint, color: style.color }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.88rem] font-semibold leading-[1.35] text-ink">
                  {item.title}
                </span>
                <span className="mt-1 block text-[0.78rem] leading-[1.55] text-ink-3">
                  {item.reason}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Abschnittskopf nach Handoff 4.3: Label, dehnbare Linie, optionaler Link. */
export function SectionHead({
  id,
  title,
  link,
}: {
  id?: string;
  title: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="mb-4 flex items-baseline gap-3.5">
      <h2
        id={id}
        className="shrink-0 text-[0.8rem] font-bold uppercase tracking-[0.1em] text-ink-3"
      >
        {title}
      </h2>
      <span aria-hidden className="h-px flex-1 bg-line" />
      {link && (
        <Link
          to={link.to}
          className="shrink-0 text-[0.75rem] font-bold text-violet hover:underline"
        >
          {link.label} →
        </Link>
      )}
    </div>
  );
}

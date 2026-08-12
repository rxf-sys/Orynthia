import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react';

/**
 * Die Status-Achse des Farbsystems.
 *
 * Regel: Statusfarbe wird **aus dem Datenwert abgeleitet**, nie aus einem
 * Serien- oder Kategorieindex. Deshalb geben alle Funktionen hier eine
 * `StatusKind` zurück und niemals eine Farbe — Farbe, Icon und Label
 * kommen ausschließlich aus `STATUS_STYLE`. Wer eine Farbe braucht, geht
 * über diesen Weg; Inline-Ternaries für Farben gehören nicht mehr in die
 * Komponenten.
 */
export type StatusKind = 'ok' | 'warn' | 'crit' | 'info' | 'idle';

export const STATUS_STYLE: Record<
  StatusKind,
  { color: string; tint: string; line: string; icon: LucideIcon; label: string }
> = {
  ok: {
    color: 'var(--pos)',
    tint: 'var(--pos-bg)',
    line: 'var(--pos-line)',
    icon: CheckCircle2,
    label: 'Im Plan',
  },
  warn: {
    color: 'var(--warn)',
    tint: 'var(--warn-bg)',
    line: 'var(--warn-line)',
    icon: AlertTriangle,
    label: 'Knapp',
  },
  crit: {
    color: 'var(--neg)',
    tint: 'var(--neg-bg)',
    line: 'var(--neg-line)',
    icon: AlertCircle,
    label: 'Überzogen',
  },
  info: {
    color: 'var(--info)',
    tint: 'var(--info-bg)',
    line: 'var(--info-line)',
    icon: Info,
    label: 'Info',
  },
  idle: {
    color: 'var(--idle)',
    tint: 'var(--idle-bg)',
    line: 'var(--idle-line)',
    icon: Ban,
    label: 'Inaktiv',
  },
};

/** Nur die Farbe – für Charts, die keine Komponente rendern können. */
export function statusColor(kind: StatusKind): string {
  return STATUS_STYLE[kind].color;
}

// ---------- Ableitungen ----------

/** Budget: Anteil des verbrauchten Betrags in Prozent. */
export function budgetStatus(pct: number): StatusKind {
  return pct > 100 ? 'crit' : pct > 80 ? 'warn' : 'ok';
}

/**
 * Liquiditätsprognose: gemessen an der Puffergrenze, nicht an Null.
 * Ein Saldo knapp über Null ist bereits ein Warnfall.
 */
export function forecastStatus(balance: number, buffer = FORECAST_BUFFER): StatusKind {
  return balance < 0 ? 'crit' : balance < buffer ? 'warn' : 'ok';
}

/** Standard-Puffergrenze der Liquiditätsprognose. */
export const FORECAST_BUFFER = 500;

/** Depot: Gewinn/Verlust je Position – nie je Serie. */
export function positionStatus(gain: number): StatusKind {
  return gain >= 0 ? 'ok' : 'crit';
}

/** Cashflow: Saldo eines Monats (Einnahmen minus Ausgaben). */
export function monthStatus(net: number): StatusKind {
  return net >= 0 ? 'ok' : 'crit';
}

/** Frist in Tagen (Vertrag, Dokument, wiederkehrende Zahlung). */
export function dueStatus(days: number): StatusKind {
  return days <= 5 ? 'warn' : days <= 60 ? 'info' : 'ok';
}

/** Aufgabe: überfällig, heute fällig oder später. */
export function taskStatus(due: Date | null | undefined, now = new Date()): StatusKind {
  if (!due) return 'idle';
  if (due.getTime() < now.getTime()) return 'crit';
  const sameDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();
  return sameDay ? 'info' : 'idle';
}

// ---------- Erwarteter Monatsverlauf ----------

/**
 * Wie weit der Monat fortgeschritten ist, in Prozent. Ohne diese Referenz
 * ist „87 % verbraucht“ nicht interpretierbar – am 11. des Monats ist das
 * viel, am 28. wenig.
 */
export function pace(now = new Date()): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.round((now.getDate() / daysInMonth) * 100);
}

/** Einordnung des Verbrauchs gegenüber dem erwarteten Monatsverlauf. */
export function paceHint(pct: number, expected = pace()): string {
  const diff = Math.round(pct - expected);
  if (diff > 10) return 'schneller als der Monat';
  if (diff < -10) return 'langsamer als der Monat';
  return 'im Takt des Monats';
}

/** Tage zwischen heute und einem Datum, aufgerundet auf ganze Tage. */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

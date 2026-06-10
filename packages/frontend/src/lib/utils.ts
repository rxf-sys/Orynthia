import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(new Date(date));
}

export function formatDateRelative(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  return formatDate(date);
}

export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.charAt(0)?.toUpperCase() || '';
  const l = lastName?.charAt(0)?.toUpperCase() || '';
  return f + l || '?';
}

/**
 * Parst Dezimaleingaben tolerant: akzeptiert deutsches Komma ("12,50"),
 * Punkt ("12.50") und Tausendertrenner ("1.234,56"). Gibt null zurück,
 * wenn die Eingabe leer oder keine endliche Zahl ist.
 */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let normalized = trimmed.replace(/\s/g, '');
  if (normalized.includes(',')) {
    // Komma als Dezimaltrennzeichen → Punkte sind Tausendertrenner
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * Extrahiert eine sinnvolle Fehlermeldung aus einem Axios- oder beliebigen Error.
 * Reihenfolge: response.data.message → response.data.error → err.message → fallback.
 */
export function parseApiError(err: unknown, fallback = 'Unbekannter Fehler'): string {
  if (!err) return fallback;
  const e = err as {
    response?: { data?: { message?: string | string[]; error?: string } };
    message?: string;
  };
  const data = e?.response?.data;
  const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
  return msg || data?.error || e?.message || fallback;
}

export type EventRecurrence = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Calendar {
  id: string;
  name: string;
  color?: string | null;
  isDefault: boolean;
  source: 'LOCAL' | 'GOOGLE' | 'APPLE' | 'ICS';
  readOnly: boolean;
  _count?: { events: number };
}

/** Eine konkrete Termin-Instanz; Serien kommen vom Server bereits expandiert. */
export interface EventOccurrence {
  id: string;
  calendarId: string;
  calendarColor: string | null;
  calendarName: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  reminderMinutes: number | null;
  recurrence: EventRecurrence | null;
  recurrenceInterval: number | null;
  recurrenceUntil: string | null;
  isRecurringInstance: boolean;
}

export interface CreateEventData {
  calendarId?: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean;
  reminderMinutes?: number;
  recurrence?: EventRecurrence;
  recurrenceInterval?: number;
  recurrenceUntil?: string;
}

export interface UpdateEventData extends Partial<Omit<CreateEventData, 'reminderMinutes' | 'recurrence' | 'recurrenceUntil'>> {
  reminderMinutes?: number | null;
  recurrence?: EventRecurrence | null;
  recurrenceUntil?: string | null;
}

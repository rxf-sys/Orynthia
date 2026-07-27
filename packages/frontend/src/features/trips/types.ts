export type TripStatus = 'PLANNED' | 'ONGOING' | 'DONE';

export type LinkableType =
  | 'TRIP'
  | 'CALENDAR_EVENT'
  | 'TASK'
  | 'LIST'
  | 'NOTE'
  | 'RECIPE'
  | 'DOCUMENT';

export interface LinkedEntity {
  linkId: string;
  type: LinkableType;
  id: string;
  title: string;
  subtitle?: string;
  to: string;
}

export interface Trip {
  id: string;
  title: string;
  destination?: string | null;
  startDate: string;
  endDate: string;
  budgetAmount?: number | string | null;
  currency: string;
  status: TripStatus;
  notes?: string | null;
}

export interface TripDetail extends Trip {
  linked: LinkedEntity[];
}

export interface CreateTripData {
  title: string;
  destination?: string;
  startDate: string;
  endDate: string;
  budgetAmount?: number;
  notes?: string;
}

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PLANNED: 'Geplant',
  ONGOING: 'Läuft',
  DONE: 'Abgeschlossen',
};

export const LINKABLE_LABEL: Record<LinkableType, string> = {
  TRIP: 'Reise',
  CALENDAR_EVENT: 'Termin',
  TASK: 'Aufgabe',
  LIST: 'Liste',
  NOTE: 'Notiz',
  RECIPE: 'Rezept',
  DOCUMENT: 'Dokument',
};

import { api } from '@/platform/api/client';
import type { Calendar, CreateEventData, EventOccurrence, IntegrationsResponse, UpdateEventData } from './types';

export const calendarApi = {
  getCalendars: () => api.get<Calendar[]>('/calendar/calendars'),
  createCalendar: (data: { name: string; color?: string; isDefault?: boolean }) =>
    api.post<Calendar>('/calendar/calendars', data),
  updateCalendar: (id: string, data: { name?: string; color?: string; isDefault?: boolean }) =>
    api.patch<Calendar>(`/calendar/calendars/${id}`, data),
  removeCalendar: (id: string) => api.delete(`/calendar/calendars/${id}`),

  getEvents: (from: string, to: string) =>
    api.get<EventOccurrence[]>('/calendar/events', { params: { from, to } }),
  getUpcoming: (days = 7, limit = 10) =>
    api.get<EventOccurrence[]>('/calendar/events/upcoming', { params: { days, limit } }),
  createEvent: (data: CreateEventData) => api.post<EventOccurrence>('/calendar/events', data),
  updateEvent: (id: string, data: UpdateEventData) => api.patch(`/calendar/events/${id}`, data),
  removeEvent: (id: string) => api.delete(`/calendar/events/${id}`),

  getIntegrations: () => api.get<IntegrationsResponse>('/calendar/integrations'),
  connectIcs: (data: { url: string; name?: string; color?: string }) =>
    api.post<{ integrationId: string; imported: number }>('/calendar/integrations/ics', data),
  googleConnect: () => api.post<{ authUrl: string }>('/calendar/integrations/google/connect'),
  googleCallback: (code: string, state: string) =>
    api.post<{ integrationId: string; imported: number }>('/calendar/integrations/google/callback', { code, state }),
  syncIntegration: (id: string) => api.post(`/calendar/integrations/${id}/sync`),
  removeIntegration: (id: string) => api.delete(`/calendar/integrations/${id}`),
};

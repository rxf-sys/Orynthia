import { api } from '@/platform/api/client';
import type { CreateTripData, LinkableType, LinkedEntity, Trip, TripDetail, TripStatus } from './types';

export const tripsApi = {
  getAll: () => api.get<Trip[]>('/trips'),
  getById: (id: string) => api.get<TripDetail>(`/trips/${id}`),
  create: (data: CreateTripData) => api.post<Trip>('/trips', data),
  update: (id: string, data: Partial<CreateTripData> & { status?: TripStatus }) =>
    api.patch<Trip>(`/trips/${id}`, data),
  remove: (id: string) => api.delete(`/trips/${id}`),

  /** Termin, Liste, Notiz oder Rezept mit der Reise verknüpfen. */
  link: (tripId: string, data: { type: LinkableType; id: string }) =>
    api.post<LinkedEntity[]>(`/trips/${tripId}/links`, data),
  unlink: (tripId: string, linkId: string) =>
    api.delete<LinkedEntity[]>(`/trips/${tripId}/links/${linkId}`),
  createPackingList: (tripId: string) =>
    api.post<{ id: string; name: string }>(`/trips/${tripId}/packing-list`),
};

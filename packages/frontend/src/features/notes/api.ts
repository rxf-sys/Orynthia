import { api } from '@/platform/api/client';
import type { CreateNoteData, Note, NoteTag } from './types';

export const notesApi = {
  getAll: (params?: { search?: string; tag?: string }) => api.get<Note[]>('/notes', { params }),
  getTags: () => api.get<NoteTag[]>('/notes/tags'),
  getById: (id: string) => api.get<Note>(`/notes/${id}`),
  create: (data: CreateNoteData) => api.post<Note>('/notes', data),
  update: (id: string, data: CreateNoteData & { pinned?: boolean }) =>
    api.patch<Note>(`/notes/${id}`, data),
  togglePin: (id: string) => api.post<Note>(`/notes/${id}/pin`),
  remove: (id: string) => api.delete(`/notes/${id}`),
};

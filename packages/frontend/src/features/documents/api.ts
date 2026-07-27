import { api } from '@/platform/api/client';
import type { Document, DocumentTag, UpdateDocumentData } from './types';

export interface UploadDocumentFields {
  title?: string;
  tags?: string;
  notes?: string;
  expiresAt?: string;
}

export const documentsApi = {
  getAll: (params?: { search?: string; tag?: string }) =>
    api.get<Document[]>('/documents', { params }),
  getTags: () => api.get<DocumentTag[]>('/documents/tags'),
  getById: (id: string) => api.get<Document>(`/documents/${id}`),

  upload: (file: File, fields: UploadDocumentFields = {}) => {
    const form = new FormData();
    form.append('file', file);
    for (const [key, value] of Object.entries(fields)) {
      if (value) form.append(key, value);
    }
    // Content-Type bewusst nicht setzen: der Browser ergänzt die
    // multipart-Boundary nur, wenn der Header offen bleibt.
    return api.post<Document>('/documents', form, {
      headers: { 'Content-Type': undefined },
      timeout: 120_000,
    });
  },

  update: (id: string, data: UpdateDocumentData) => api.patch<Document>(`/documents/${id}`, data),
  remove: (id: string) => api.delete(`/documents/${id}`),

  /** Lädt den entschlüsselten Inhalt als Blob (Download läuft über den JWT-Guard). */
  download: (id: string) =>
    api.get<Blob>(`/documents/${id}/download`, { responseType: 'blob', timeout: 120_000 }),
};

/** Blob als Datei speichern, ohne ihn je inline zu rendern. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

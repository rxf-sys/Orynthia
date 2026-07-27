export interface Document {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  notes?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTag {
  tag: string;
  count: number;
}

export interface UpdateDocumentData {
  title?: string;
  tags?: string[];
  notes?: string | null;
  expiresAt?: string | null;
}

/** 20 MB – muss zu MAX_DOCUMENT_BYTES im Backend passen. */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/**
 * Erlaubte Endungen, gespiegelt aus der Backend-Whitelist. Dient nur der
 * Bedienführung (Dateiauswahl vorfiltern) – geprüft wird serverseitig.
 */
export const ACCEPTED_EXTENSIONS =
  '.pdf,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv,.doc,.docx,.xls,.xlsx';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

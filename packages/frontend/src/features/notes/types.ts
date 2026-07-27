export interface Note {
  id: string;
  title?: string | null;
  content: string;
  tags: string[];
  color?: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  color?: string;
}

export interface NoteTag {
  tag: string;
  count: number;
}

export const NOTE_COLORS = [
  '#fda481',
  '#5b8def',
  '#1f8a5b',
  '#b97aff',
  '#e76b8d',
  '#3aa3a5',
  '#d99a2b',
];

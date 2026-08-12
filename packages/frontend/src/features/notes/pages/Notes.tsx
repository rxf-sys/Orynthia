import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Loader2, Pin, PinOff, Plus, Search, StickyNote, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { notesApi } from '@/features/notes/api';
import { NOTE_COLORS, type Note } from '@/features/notes/types';
import { cn, parseApiError } from '@/lib/utils';
import { Btn, Card, EmptyState, Field, IconBtn, Modal, PageHead, useConfirm } from '@/components/ui';

export function NotesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState({ title: '', content: '', tags: '', color: '' });

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', search, tagFilter],
    queryFn: () =>
      notesApi.getAll({ search: search || undefined, tag: tagFilter ?? undefined }).then((r) => r.data),
  });

  const { data: tags } = useQuery({
    queryKey: ['note-tags'],
    queryFn: () => notesApi.getTags().then((r) => r.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    queryClient.invalidateQueries({ queryKey: ['note-tags'] });
  };

  const saveMutation = useMutation({
    mutationFn: (data: { title: string; content: string; tags: string[]; color?: string }) =>
      editing ? notesApi.update(editing.id, data) : notesApi.create(data),
    onSuccess: () => {
      invalidate();
      closeEditor();
      toast.success(editing ? 'Notiz gespeichert' : 'Notiz erstellt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const pinMutation = useMutation({
    mutationFn: notesApi.togglePin,
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Anpinnen')),
  });

  const deleteMutation = useMutation({
    mutationFn: notesApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success('Notiz gelöscht');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const [editorOpen, setEditorOpen] = useState(false);

  const openEditor = (note?: Note) => {
    setEditing(note ?? null);
    setForm({
      title: note?.title ?? '',
      content: note?.content ?? '',
      tags: note?.tags.join(', ') ?? '',
      color: note?.color ?? '',
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
  };

  // Beim Schließen ohne Inhalt nichts speichern
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() && !form.content.trim()) return;
    saveMutation.mutate({
      title: form.title.trim() || undefined,
      content: form.content,
      tags: form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      color: form.color || undefined,
    } as { title: string; content: string; tags: string[]; color?: string });
  };

  return (
    <div className="space-y-5">
      <PageHead
        title="Notizen"
        sub={`${notes?.length ?? 0} Notiz${notes?.length === 1 ? '' : 'en'}`}
        actions={
          <Btn variant="grad" icon={Plus} onClick={() => openEditor()}>
            Neue Notiz
          </Btn>
        }
      />

      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Notizen durchsuchen…"
              className="input pl-9"
              aria-label="Notizen durchsuchen"
            />
          </div>
          <Btn type="submit">Suchen</Btn>
        </form>

        {(tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tags!.slice(0, 12).map((t) => (
              <button
                key={t.tag}
                onClick={() => setTagFilter(tagFilter === t.tag ? null : t.tag)}
                aria-pressed={tagFilter === t.tag}
                className={cn(
                  'rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
                  tagFilter === t.tag
                    ? 'border-indigo bg-indigo text-white'
                    : 'border-line bg-elev text-ink-2 hover:bg-soft',
                )}
              >
                #{t.tag} <span className="tnum opacity-70">{t.count}</span>
              </button>
            ))}
            {(tagFilter || search) && (
              <button
                onClick={() => {
                  setTagFilter(null);
                  setSearch('');
                  setSearchInput('');
                }}
                className="flex items-center gap-1 rounded-pill px-2.5 py-1.5 text-sm text-ink-3 hover:text-ink"
              >
                <X className="h-3 w-3" /> Zurücksetzen
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : (notes?.length ?? 0) === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={search || tagFilter ? 'Keine Treffer' : 'Noch keine Notizen'}
          description={
            search || tagFilter
              ? 'Passe die Suche an oder setze die Filter zurück.'
              : 'Halte fest, was du dir merken willst – mit Tags sortiert und über ⌘K jederzeit auffindbar.'
          }
          action={
            search || tagFilter
              ? {
                  label: 'Zurücksetzen',
                  onClick: () => {
                    setTagFilter(null);
                    setSearch('');
                    setSearchInput('');
                  },
                }
              : { label: 'Notiz anlegen', onClick: () => openEditor(), icon: Plus }
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes!.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={() => openEditor(note)}
              onPin={() => pinMutation.mutate(note.id)}
              onDelete={async () => {
                const ok = await confirm({
                  title: 'Notiz löschen?',
                  description: note.title || note.content.slice(0, 80),
                  confirmLabel: 'Löschen',
                  destructive: true,
                });
                if (ok) deleteMutation.mutate(note.id);
              }}
            />
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title={editing ? 'Notiz bearbeiten' : 'Neue Notiz'}
        footer={
          <>
            <Btn variant="ghost" onClick={closeEditor}>
              Abbrechen
            </Btn>
            <Btn
              variant="grad"
              type="submit"
              form="note-form"
              disabled={saveMutation.isPending || (!form.title.trim() && !form.content.trim())}
            >
              Speichern
            </Btn>
          </>
        }
      >
        <form id="note-form" onSubmit={submit} className="space-y-4">
          <Field label="Titel">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
              placeholder="Optional"
            />
          </Field>
          <Field label="Inhalt">
            <textarea
              className="input min-h-[180px]"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              maxLength={50_000}
              autoFocus
            />
          </Field>
          <Field label="Tags" hint="Kommagetrennt, z. B. urlaub, wichtig">
            <input
              className="input"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </Field>
          <Field label="Farbe">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, color: '' })}
                aria-label="Keine Farbe"
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-pill border-2 text-xs',
                  form.color === '' ? 'border-ink' : 'border-line',
                )}
              >
                –
              </button>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Farbe ${c}`}
                  className={cn(
                    'h-7 w-7 rounded-pill border-2',
                    form.color === c ? 'border-ink' : 'border-transparent',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function NoteCard({
  note,
  onOpen,
  onPin,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      hover
      className="group flex flex-col gap-2"
      // Nutzerfarbe als linke Kante (Farbachse 3), nie als Fläche
      style={note.color ? { borderLeftColor: note.color, borderLeftWidth: 4 } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h3 className="truncate text-sm font-bold text-ink">
            {note.title || note.content.slice(0, 40) || (
              <span className="text-ink-3">Ohne Titel</span>
            )}
          </h3>
        </button>
        <div className="flex shrink-0 gap-0.5">
          <IconBtn
            variant="quiet"
            size="sm"
            icon={note.pinned ? Pin : PinOff}
            aria-label={note.pinned ? 'Losheften' : 'Anpinnen'}
            className={cn(note.pinned && 'text-peach')}
            onClick={onPin}
          />
          <IconBtn
            variant="quiet"
            size="sm"
            icon={Trash2}
            aria-label="Löschen"
            className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
            onClick={onDelete}
          />
        </div>
      </div>
      <button onClick={onOpen} className="text-left">
        <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
          {note.content || <span className="text-ink-4">Kein Inhalt</span>}
        </p>
      </button>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        {note.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-pill bg-soft px-2 py-0.5 text-[0.68rem] text-ink-3">
            #{tag}
          </span>
        ))}
        <span className="ml-auto text-[0.68rem] text-ink-4">
          {formatDistanceToNow(parseISO(note.updatedAt), { addSuffix: true, locale: de })}
        </span>
      </div>
    </Card>
  );
}

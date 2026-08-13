import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentsApi, saveBlob } from '@/features/documents/api';
import {
  ACCEPTED_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  formatBytes,
  type Document,
} from '@/features/documents/types';
import { cn, parseApiError } from '@/lib/utils';
import { daysUntil, dueStatus, type StatusKind } from '@/lib/status';
import {
  Btn,
  Card,
  EmptyState,
  Field,
  IconBtn,
  Modal,
  PageHead,
  StatusBadge,
  useConfirm,
} from '@/components/ui';

function iconFor(mimeType: string): LucideIcon {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return FileSpreadsheet;
  if (mimeType === 'application/pdf') return FileText;
  return FileArchive;
}

/**
 * Gültigkeit als Status: abgelaufen ist kritisch, eine nahe Frist warnend.
 * Die Schwellen kommen aus der gemeinsamen Ableitung, nicht aus einer
 * eigenen Ternary-Kette in dieser Datei.
 */
function expiryStatus(expiresAt: string): StatusKind {
  const days = daysUntil(parseISO(expiresAt));
  return days < 0 ? 'crit' : dueStatus(days);
}

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ title: '', tags: '', notes: '', expiresAt: '' });
  const [editing, setEditing] = useState<Document | null>(null);
  const [editForm, setEditForm] = useState({ title: '', tags: '', notes: '', expiresAt: '' });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', search, tagFilter],
    queryFn: () =>
      documentsApi
        .getAll({ search: search || undefined, tag: tagFilter ?? undefined })
        .then((r) => r.data),
  });

  const { data: tags } = useQuery({
    queryKey: ['document-tags'],
    queryFn: () => documentsApi.getTags().then((r) => r.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['document-tags'] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      documentsApi.upload(file, {
        title: uploadForm.title.trim() || undefined,
        tags: uploadForm.tags.trim() || undefined,
        notes: uploadForm.notes.trim() || undefined,
        expiresAt: uploadForm.expiresAt ? new Date(uploadForm.expiresAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      invalidate();
      closeUpload();
      toast.success('Dokument verschlüsselt abgelegt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Upload fehlgeschlagen')),
  });

  const updateMutation = useMutation({
    mutationFn: (doc: Document) =>
      documentsApi.update(doc.id, {
        title: editForm.title.trim() || doc.filename,
        tags: editForm.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        notes: editForm.notes.trim() || null,
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success('Dokument aktualisiert');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const deleteMutation = useMutation({
    mutationFn: documentsApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success('Dokument gelöscht');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (doc: Document) => {
    setDownloadingId(doc.id);
    try {
      const res = await documentsApi.download(doc.id);
      saveBlob(res.data, doc.filename);
    } catch (e) {
      toast.error(parseApiError(e, 'Download fehlgeschlagen'));
    } finally {
      setDownloadingId(null);
    }
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error(`Datei ist zu groß (max. ${formatBytes(MAX_DOCUMENT_BYTES)})`);
      return;
    }
    setPending(file);
    setUploadForm({ title: '', tags: '', notes: '', expiresAt: '' });
  };

  const closeUpload = () => {
    setPending(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditor = (doc: Document) => {
    setEditing(doc);
    setEditForm({
      title: doc.title,
      tags: doc.tags.join(', '),
      notes: doc.notes ?? '',
      expiresAt: doc.expiresAt ? doc.expiresAt.slice(0, 10) : '',
    });
  };

  const resetFilters = () => {
    setTagFilter(null);
    setSearch('');
    setSearchInput('');
  };

  return (
    <div className="space-y-5">
      <PageHead
        title="Dokumente"
        sub={`${documents?.length ?? 0} Dokument${documents?.length === 1 ? '' : 'e'} · verschlüsselt abgelegt`}
        actions={
          <Btn variant="grad" icon={Upload} onClick={() => fileInputRef.current?.click()}>
            Hochladen
          </Btn>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex items-start gap-2.5 rounded-md border border-line bg-soft px-3.5 py-2.5">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
        <p className="text-xs leading-relaxed text-ink-3">
          Alle Dateien liegen AES-256-verschlüsselt auf dem Server – ohne deinen
          Verschlüsselungsschlüssel ist ein Backup wertlos. Downloads laufen ausschließlich über
          deine angemeldete Sitzung.
        </p>
      </div>

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
              placeholder="Dokumente durchsuchen…"
              className="input pl-9"
              aria-label="Dokumente durchsuchen"
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
                onClick={resetFilters}
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
      ) : (documents?.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileText}
          title={search || tagFilter ? 'Keine Treffer' : 'Noch keine Dokumente'}
          description={
            search || tagFilter
              ? 'Passe die Suche an oder setze die Filter zurück.'
              : 'Verträge, Rechnungen und Ausweise an einem Ort – verschlüsselt und mit Ablauf-Erinnerung.'
          }
          action={
            search || tagFilter
              ? { label: 'Zurücksetzen', onClick: resetFilters }
              : {
                  label: 'Dokument hochladen',
                  onClick: () => fileInputRef.current?.click(),
                  icon: Upload,
                }
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents!.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              downloading={downloadingId === doc.id}
              onDownload={() => handleDownload(doc)}
              onEdit={() => openEditor(doc)}
              onDelete={async () => {
                const ok = await confirm({
                  title: 'Dokument löschen?',
                  description: `„${doc.title}" wird unwiderruflich gelöscht – Datei und Verknüpfungen.`,
                  confirmLabel: 'Löschen',
                  destructive: true,
                });
                if (ok) deleteMutation.mutate(doc.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Upload-Dialog: Datei ist bereits gewählt, hier folgen nur die Metadaten */}
      <Modal
        open={pending !== null}
        onClose={closeUpload}
        title="Dokument hochladen"
        footer={
          <>
            <Btn variant="ghost" onClick={closeUpload}>
              Abbrechen
            </Btn>
            <Btn
              variant="grad"
              type="submit"
              form="upload-form"
              disabled={uploadMutation.isPending}
              icon={uploadMutation.isPending ? Loader2 : Upload}
            >
              {uploadMutation.isPending ? 'Wird verschlüsselt…' : 'Hochladen'}
            </Btn>
          </>
        }
      >
        <form
          id="upload-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) uploadMutation.mutate(pending);
          }}
          className="space-y-4"
        >
          {pending && (
            <div className="flex items-center gap-2.5 rounded-md border border-line bg-soft px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{pending.name}</div>
                <div className="text-xs text-ink-3">{formatBytes(pending.size)}</div>
              </div>
            </div>
          )}
          <Field label="Titel" hint="Ohne Angabe wird der Dateiname verwendet">
            <input
              className="input"
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              maxLength={200}
              autoFocus
            />
          </Field>
          <Field label="Tags" hint="Kommagetrennt, z. B. versicherung, 2026">
            <input
              className="input"
              value={uploadForm.tags}
              onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
            />
          </Field>
          <Field label="Gültig bis" hint="Optional – erinnert dich rechtzeitig, z. B. beim Ausweis">
            <input
              type="date"
              className="input"
              value={uploadForm.expiresAt}
              onChange={(e) => setUploadForm({ ...uploadForm, expiresAt: e.target.value })}
            />
          </Field>
          <Field label="Notiz">
            <textarea
              className="input min-h-[80px]"
              value={uploadForm.notes}
              onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
              maxLength={2000}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Dokument bearbeiten"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditing(null)}>
              Abbrechen
            </Btn>
            <Btn variant="grad" type="submit" form="doc-form" disabled={updateMutation.isPending}>
              Speichern
            </Btn>
          </>
        }
      >
        <form
          id="doc-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (editing) updateMutation.mutate(editing);
          }}
          className="space-y-4"
        >
          <Field label="Titel">
            <input
              className="input"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              maxLength={200}
            />
          </Field>
          <Field label="Tags" hint="Kommagetrennt">
            <input
              className="input"
              value={editForm.tags}
              onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
            />
          </Field>
          <Field label="Gültig bis">
            <input
              type="date"
              className="input"
              value={editForm.expiresAt}
              onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
            />
          </Field>
          <Field label="Notiz">
            <textarea
              className="input min-h-[80px]"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              maxLength={2000}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function DocumentCard({
  doc,
  downloading,
  onDownload,
  onEdit,
  onDelete,
}: {
  doc: Document;
  downloading: boolean;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = iconFor(doc.mimeType);

  return (
    <Card hover className="group flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-soft text-ink-2">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-ink" title={doc.title}>
            {doc.title}
          </h3>
          <p className="truncate text-[0.72rem] text-ink-4" title={doc.filename}>
            {doc.filename} · {formatBytes(doc.sizeBytes)}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <IconBtn
            variant="quiet"
            size="sm"
            icon={downloading ? Loader2 : Download}
            aria-label="Herunterladen"
            className={cn(downloading && 'animate-spin')}
            disabled={downloading}
            onClick={onDownload}
          />
          <IconBtn
            variant="quiet"
            size="sm"
            icon={Pencil}
            aria-label="Bearbeiten"
            className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
            onClick={onEdit}
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

      {doc.notes && <p className="line-clamp-2 text-xs leading-relaxed text-ink-2">{doc.notes}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5">
        {doc.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-pill bg-soft px-2 py-0.5 text-[0.68rem] text-ink-3">
            #{tag}
          </span>
        ))}
        {doc.expiresAt ? (
          <StatusBadge
            kind={expiryStatus(doc.expiresAt)}
            size="sm"
            label={`${daysUntil(parseISO(doc.expiresAt)) < 0 ? 'abgelaufen' : 'gültig bis'} ${format(parseISO(doc.expiresAt), 'dd.MM.yyyy', { locale: de })}`}
          />
        ) : (
          <StatusBadge kind="idle" size="sm" label="ohne Ablauf" />
        )}
        <span className="ml-auto text-[0.68rem] text-ink-4">
          {format(parseISO(doc.createdAt), 'dd.MM.yyyy', { locale: de })}
        </span>
      </div>
    </Card>
  );
}

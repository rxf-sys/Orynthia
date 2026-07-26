import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChefHat,
  Circle,
  CheckCircle2,
  ClipboardList,
  Eraser,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { listsApi } from '@/features/lists/api';
import {
  LIST_TYPE_ICON,
  LIST_TYPE_LABEL,
  type ListItem,
  type ListType,
} from '@/features/lists/types';
import { cn, parseApiError } from '@/lib/utils';
import { Btn, Card, EmptyState, Field, IconBtn, Modal, PageHead, useConfirm } from '@/components/ui';

export function ListsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [showListForm, setShowListForm] = useState(false);
  const [listForm, setListForm] = useState<{ name: string; type: ListType }>({
    name: '',
    type: 'SHOPPING',
  });
  const [quickItem, setQuickItem] = useState('');

  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => listsApi.getAll().then((r) => r.data),
  });

  // Ohne :id die erste Liste öffnen, damit die Seite nie leer wirkt
  const activeId = id ?? lists?.[0]?.id;

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['list', activeId],
    queryFn: () => listsApi.getById(activeId!).then((r) => r.data),
    enabled: !!activeId,
  });

  useEffect(() => {
    if (!id && lists?.length) navigate(`/lists/${lists[0].id}`, { replace: true });
  }, [id, lists, navigate]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lists'] });
    queryClient.invalidateQueries({ queryKey: ['list'] });
  };

  const createListMutation = useMutation({
    mutationFn: listsApi.create,
    onSuccess: (r) => {
      invalidate();
      setShowListForm(false);
      setListForm({ name: '', type: 'SHOPPING' });
      navigate(`/lists/${r.data.id}`);
      toast.success('Liste erstellt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Erstellen')),
  });

  const deleteListMutation = useMutation({
    mutationFn: listsApi.remove,
    onSuccess: () => {
      invalidate();
      navigate('/lists', { replace: true });
      toast.success('Liste gelöscht');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const addItemMutation = useMutation({
    mutationFn: (name: string) => listsApi.addItem(activeId!, { name }),
    onSuccess: () => {
      invalidate();
      setQuickItem('');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Hinzufügen')),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Parameters<typeof listsApi.updateItem>[1] }) =>
      listsApi.updateItem(itemId, data),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const removeItemMutation = useMutation({
    mutationFn: listsApi.removeItem,
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const clearCheckedMutation = useMutation({
    mutationFn: () => listsApi.clearChecked(activeId!),
    onSuccess: (r) => {
      invalidate();
      toast.success(`${r.data.removed} erledigte Einträge entfernt`);
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Aufräumen')),
  });

  const { open, checked } = useMemo(() => {
    const items = list?.items ?? [];
    return {
      open: items.filter((i) => !i.checked),
      checked: items.filter((i) => i.checked),
    };
  }, [list]);

  return (
    <div className="space-y-5">
      <PageHead
        title="Listen"
        sub={
          list
            ? `${open.length} offen${checked.length ? ` · ${checked.length} erledigt` : ''}`
            : `${lists?.length ?? 0} Listen`
        }
        actions={
          <Btn variant="grad" icon={Plus} onClick={() => setShowListForm(true)}>
            Neue Liste
          </Btn>
        }
      />

      {/* Listen-Auswahl */}
      {(lists?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {lists!.map((l) => (
            <button
              key={l.id}
              onClick={() => navigate(`/lists/${l.id}`)}
              className={cn(
                'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
                l.id === activeId
                  ? 'border-indigo bg-indigo text-white'
                  : 'border-line bg-elev text-ink-2 hover:bg-soft',
              )}
            >
              <span aria-hidden>{l.icon ?? LIST_TYPE_ICON[l.type]}</span>
              {l.name}
              {(l._count?.items ?? 0) > 0 && (
                <span className="tnum opacity-70">({l._count!.items})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {listsLoading || (activeId && listLoading) ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : !list ? (
        <EmptyState
          icon={ClipboardList}
          title="Noch keine Listen"
          description="Lege deine erste Liste an – als Einkaufsliste, Packliste, Checkliste oder Wunschliste. Zutaten aus Rezepten kannst du direkt übernehmen."
          action={{ label: 'Liste anlegen', onClick: () => setShowListForm(true), icon: Plus }}
        />
      ) : (
        <>
          {/* Quick-Add */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = quickItem.trim();
              if (name) addItemMutation.mutate(name);
            }}
            className="flex gap-2"
          >
            <input
              value={quickItem}
              onChange={(e) => setQuickItem(e.target.value)}
              placeholder="Eintrag hinzufügen… (Enter)"
              className="input flex-1"
              aria-label="Neuer Eintrag"
              disabled={addItemMutation.isPending}
            />
            <Btn type="submit" icon={Plus} disabled={!quickItem.trim() || addItemMutation.isPending}>
              Hinzufügen
            </Btn>
          </form>

          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <span aria-hidden>{list.icon ?? LIST_TYPE_ICON[list.type]}</span>
              {list.name}
              <span className="text-xs font-medium text-ink-3">{LIST_TYPE_LABEL[list.type]}</span>
            </h2>
            <div className="flex gap-1">
              {checked.length > 0 && (
                <Btn
                  variant="ghost"
                  size="sm"
                  icon={Eraser}
                  onClick={() => clearCheckedMutation.mutate()}
                >
                  Aufräumen
                </Btn>
              )}
              <IconBtn
                variant="quiet"
                size="sm"
                icon={Trash2}
                aria-label="Liste löschen"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Liste „${list.name}" löschen?`,
                    description: 'Alle Einträge dieser Liste werden entfernt.',
                    confirmLabel: 'Löschen',
                    destructive: true,
                  });
                  if (ok) deleteListMutation.mutate(list.id);
                }}
              />
            </div>
          </div>

          {list.items.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              compact
              title="Liste ist leer"
              description="Füge oben Einträge hinzu – oder übernimm Zutaten aus einem Rezept."
            />
          ) : (
            <Card className="divide-y divide-line p-0">
              {[...open, ...checked].map((item) => (
                <ListRow
                  key={item.id}
                  item={item}
                  onToggle={() =>
                    updateItemMutation.mutate({
                      itemId: item.id,
                      data: { checked: !item.checked },
                    })
                  }
                  onRename={(name, amount, unit) =>
                    updateItemMutation.mutate({
                      itemId: item.id,
                      data: { name, amount: amount ?? null, unit: unit ?? null },
                    })
                  }
                  onDelete={() => removeItemMutation.mutate(item.id)}
                />
              ))}
            </Card>
          )}
        </>
      )}

      {/* Neue Liste */}
      <Modal
        open={showListForm}
        onClose={() => setShowListForm(false)}
        title="Neue Liste"
        size="sm"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setShowListForm(false)}>
              Abbrechen
            </Btn>
            <Btn
              variant="grad"
              icon={Check}
              type="submit"
              form="list-form"
              disabled={!listForm.name.trim() || createListMutation.isPending}
            >
              Erstellen
            </Btn>
          </>
        }
      >
        <form
          id="list-form"
          onSubmit={(e) => {
            e.preventDefault();
            createListMutation.mutate({ name: listForm.name.trim(), type: listForm.type });
          }}
          className="space-y-4"
        >
          <Field label="Name" required>
            <input
              className="input"
              value={listForm.name}
              onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
              placeholder="z. B. Wocheneinkauf"
              maxLength={100}
            />
          </Field>
          <Field label="Art">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(LIST_TYPE_LABEL) as ListType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setListForm({ ...listForm, type: t })}
                  aria-pressed={listForm.type === t}
                  className={cn(
                    'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
                    listForm.type === t
                      ? 'border-indigo bg-indigo text-white'
                      : 'border-line bg-elev text-ink-2 hover:bg-soft',
                  )}
                >
                  <span aria-hidden>{LIST_TYPE_ICON[t]}</span>
                  {LIST_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function ListRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: ListItem;
  onToggle: () => void;
  onRename: (name: string, amount?: number, unit?: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: item.name,
    amount: item.amount != null ? String(item.amount) : '',
    unit: item.unit ?? '',
  });

  const save = () => {
    const name = draft.name.trim();
    if (!name) return setEditing(false);
    onRename(
      name,
      draft.amount === '' ? undefined : Number(draft.amount),
      draft.unit.trim() || undefined,
    );
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5">
        <input
          className="input w-20"
          type="number"
          step="any"
          min={0}
          value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          aria-label="Menge"
        />
        <input
          className="input w-20"
          value={draft.unit}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          placeholder="Einheit"
          aria-label="Einheit"
          maxLength={30}
        />
        <input
          className="input flex-1"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          aria-label="Name"
          maxLength={200}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <IconBtn variant="quiet" size="sm" icon={Check} aria-label="Speichern" onClick={save} />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5">
      <button
        onClick={onToggle}
        aria-label={item.checked ? 'Als offen markieren' : 'Als erledigt markieren'}
        className="shrink-0 text-ink-3 transition-colors hover:text-indigo"
      >
        {item.checked ? (
          <CheckCircle2 className="h-5 w-5 text-pos" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'text-sm',
            item.checked ? 'text-ink-3 line-through' : 'font-medium text-ink',
          )}
        >
          {item.amount != null && <span className="tnum mr-1.5 font-semibold">{String(item.amount)}</span>}
          {item.unit && <span className="mr-1.5 text-ink-3">{item.unit}</span>}
          {item.name}
        </span>
        {item.recipeId && (
          <span className="ml-2 inline-flex items-center gap-1 text-[0.7rem] text-ink-3">
            <ChefHat className="h-3 w-3" /> aus Rezept
          </span>
        )}
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <IconBtn
          variant="quiet"
          size="sm"
          icon={Pencil}
          aria-label="Bearbeiten"
          onClick={() => setEditing(true)}
        />
        <IconBtn variant="quiet" size="sm" icon={Trash2} aria-label="Löschen" onClick={onDelete} />
      </div>
    </div>
  );
}

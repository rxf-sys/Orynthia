import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isPast, isToday } from 'date-fns';
import { STATUS_STYLE, type StatusKind } from '@/lib/status';
import {
  CheckSquare,
  Check,
  Circle,
  CheckCircle2,
  Flag,
  List,
  Loader2,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tasksApi } from '@/features/tasks/api';
import type { Task, TaskPriority, TaskRecurrence, UpdateTaskData } from '@/features/tasks/types';
import { cn, formatDate, parseApiError } from '@/lib/utils';
import { Btn, Card, EmptyState, Field, IconBtn, Modal, PageHead, useConfirm } from '@/components/ui';

const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: 'Niedrig', MEDIUM: 'Mittel', HIGH: 'Hoch' };
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  LOW: 'var(--ink-3)',
  MEDIUM: 'var(--info)',
  HIGH: 'var(--neg)',
};
const RECURRENCE_LABEL: Record<TaskRecurrence, string> = {
  DAILY: 'Täglich',
  WEEKLY: 'Wöchentlich',
  BIWEEKLY: 'Alle 2 Wochen',
  MONTHLY: 'Monatlich',
  YEARLY: 'Jährlich',
};

const LIST_COLORS = ['#37415c', '#fda481', '#5b8def', '#1f8a5b', '#b97aff', '#e76b8d', '#3aa3a5', '#d99a2b'];

interface TaskFormState {
  title: string;
  notes: string;
  priority: TaskPriority;
  dueAt: string;
  recurrence: '' | TaskRecurrence;
  taskListId: string;
}

const EMPTY_FORM: TaskFormState = {
  title: '',
  notes: '',
  priority: 'MEDIUM',
  dueAt: '',
  recurrence: '',
  taskListId: '',
};

export function TasksPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [statusFilter, setStatusFilter] = useState<'open' | 'completed'>('open');
  const [listFilter, setListFilter] = useState<string | 'all'>('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [showListForm, setShowListForm] = useState(false);
  const [listForm, setListForm] = useState({ name: '', color: LIST_COLORS[2] });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['task-lists'] });
  };

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', statusFilter, listFilter],
    queryFn: () =>
      tasksApi
        .getAll({ status: statusFilter, taskListId: listFilter === 'all' ? undefined : listFilter })
        .then((r) => r.data),
  });

  const { data: lists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: () => tasksApi.getLists().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      invalidate();
      setQuickTitle('');
      setEditTask(null);
      setForm(EMPTY_FORM);
      toast.success('Aufgabe erstellt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Erstellen')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskData }) => tasksApi.update(id, data),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success('Aufgabe gelöscht');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const createListMutation = useMutation({
    mutationFn: tasksApi.createList,
    onSuccess: () => {
      invalidate();
      setShowListForm(false);
      setListForm({ name: '', color: LIST_COLORS[2] });
      toast.success('Liste erstellt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Erstellen')),
  });

  const deleteListMutation = useMutation({
    mutationFn: tasksApi.removeList,
    onSuccess: () => {
      setListFilter('all');
      invalidate();
      toast.success('Liste gelöscht – Aufgaben bleiben erhalten');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const grouped = useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const later: Task[] = [];
    const noDate: Task[] = [];
    for (const task of tasks ?? []) {
      if (!task.dueAt) noDate.push(task);
      else if (isToday(new Date(task.dueAt))) today.push(task);
      else if (isPast(new Date(task.dueAt))) overdue.push(task);
      else later.push(task);
    }
    return { overdue, today, later, noDate };
  }, [tasks]);

  const openEdit = (task: Task) => {
    setEditTask(task);
    setForm({
      title: task.title,
      notes: task.notes ?? '',
      priority: task.priority,
      dueAt: task.dueAt ? task.dueAt.slice(0, 16) : '',
      recurrence: task.recurrence ?? '',
      taskListId: task.taskListId ?? '',
    });
  };

  const submitQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    createMutation.mutate({
      title,
      taskListId: listFilter === 'all' ? undefined : listFilter,
    });
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    const data: UpdateTaskData = {
      title: form.title.trim(),
      notes: form.notes.trim() || undefined,
      priority: form.priority,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      recurrence: form.recurrence || null,
      taskListId: form.taskListId || null,
    };
    updateMutation.mutate(
      { id: editTask.id, data },
      {
        onSuccess: () => {
          setEditTask(null);
          setForm(EMPTY_FORM);
          toast.success('Aufgabe gespeichert');
        },
      },
    );
  };

  const toggleComplete = (task: Task) => {
    updateMutation.mutate({ id: task.id, data: { completed: !task.completedAt } });
  };

  const openCount = lists?.reduce((sum, l) => sum + (l._count?.tasks ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHead
        title="Aufgaben"
        sub={statusFilter === 'open' ? `${tasks?.length ?? 0} offen` : `${tasks?.length ?? 0} erledigt`}
        actions={
          <Btn variant="grad" icon={Plus} onClick={() => setShowListForm(true)}>
            Neue Liste
          </Btn>
        }
      />

      {/* Listen-Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setListFilter('all')}
          className={cn(
            'rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
            listFilter === 'all'
              ? 'border-indigo bg-indigo text-white'
              : 'border-line bg-elev text-ink-2 hover:bg-soft',
          )}
        >
          Alle{openCount !== undefined ? ` (${openCount})` : ''}
        </button>
        {lists?.map((list) => (
          <button
            key={list.id}
            onClick={() => setListFilter(list.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
              listFilter === list.id
                ? 'border-indigo bg-indigo text-white'
                : 'border-line bg-elev text-ink-2 hover:bg-soft',
            )}
          >
            <span
              className="h-2 w-2 rounded-pill"
              style={{ background: list.color ?? 'var(--ink-4)' }}
              aria-hidden
            />
            {list.name}
            {list._count !== undefined && ` (${list._count.tasks})`}
          </button>
        ))}
        <div className="ml-auto flex gap-1 rounded-md border border-line bg-elev p-0.5">
          {(['open', 'completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-semibold',
                statusFilter === s ? 'bg-soft text-ink' : 'text-ink-3 hover:text-ink',
              )}
            >
              {s === 'open' ? 'Offen' : 'Erledigt'}
            </button>
          ))}
        </div>
        {listFilter !== 'all' && (
          <IconBtn
            variant="quiet"
            size="sm"
            icon={Trash2}
            aria-label="Liste löschen"
            onClick={async () => {
              const list = lists?.find((l) => l.id === listFilter);
              const ok = await confirm({
                title: `Liste „${list?.name}“ löschen?`,
                description: 'Die Aufgaben der Liste bleiben erhalten.',
                confirmLabel: 'Löschen',
                destructive: true,
              });
              if (ok) deleteListMutation.mutate(listFilter);
            }}
          />
        )}
      </div>

      {/* Quick-Add */}
      <form onSubmit={submitQuickAdd} className="flex gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Neue Aufgabe… (Enter zum Anlegen)"
          className="input flex-1"
          aria-label="Neue Aufgabe"
          disabled={createMutation.isPending}
        />
        <Btn type="submit" icon={Plus} disabled={createMutation.isPending || !quickTitle.trim()}>
          Hinzufügen
        </Btn>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : (tasks?.length ?? 0) === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={statusFilter === 'open' ? 'Keine offenen Aufgaben' : 'Noch nichts erledigt'}
          description={
            statusFilter === 'open'
              ? 'Lege oben deine erste Aufgabe an – mit Priorität, Fälligkeit und Wiederholung.'
              : 'Erledigte Aufgaben erscheinen hier.'
          }
        />
      ) : (
        <div className="space-y-5">
          {statusFilter === 'open' ? (
            <>
              <TaskGroup title="Überfällig" status="crit" tasks={grouped.overdue} onToggle={toggleComplete} onEdit={openEdit} onDelete={(t) => deleteMutation.mutate(t.id)} />
              <TaskGroup title="Heute" status="info" tasks={grouped.today} onToggle={toggleComplete} onEdit={openEdit} onDelete={(t) => deleteMutation.mutate(t.id)} />
              <TaskGroup title="Später" status="idle" tasks={grouped.later} onToggle={toggleComplete} onEdit={openEdit} onDelete={(t) => deleteMutation.mutate(t.id)} />
              <TaskGroup title="Ohne Fälligkeit" status="idle" tasks={grouped.noDate} onToggle={toggleComplete} onEdit={openEdit} onDelete={(t) => deleteMutation.mutate(t.id)} />
            </>
          ) : (
            <TaskGroup title="Erledigt" tasks={tasks ?? []} onToggle={toggleComplete} onEdit={openEdit} onDelete={(t) => deleteMutation.mutate(t.id)} />
          )}
        </div>
      )}

      {/* Bearbeiten-Modal */}
      <Modal
        open={!!editTask}
        onClose={() => setEditTask(null)}
        title="Aufgabe bearbeiten"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditTask(null)}>
              Abbrechen
            </Btn>
            <Btn
              variant="grad"
              icon={Check}
              type="submit"
              form="task-edit-form"
              disabled={updateMutation.isPending || !form.title.trim()}
            >
              Speichern
            </Btn>
          </>
        }
      >
        <form id="task-edit-form" onSubmit={submitEdit} className="space-y-4">
          <Field label="Titel" required>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={300}
            />
          </Field>
          <Field label="Notizen">
            <textarea
              className="input min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={5000}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priorität">
              <select
                className="select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              >
                {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Liste">
              <select
                className="select"
                value={form.taskListId}
                onChange={(e) => setForm({ ...form, taskListId: e.target.value })}
              >
                <option value="">Keine Liste</option>
                {lists?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fällig am" hint="Leer lassen für „ohne Fälligkeit“">
              <input
                type="datetime-local"
                className="input"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </Field>
            <Field label="Wiederholung" hint="Beim Erledigen entsteht die nächste Instanz">
              <select
                className="select"
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value as '' | TaskRecurrence })}
                disabled={!form.dueAt}
              >
                <option value="">Keine</option>
                {(Object.keys(RECURRENCE_LABEL) as TaskRecurrence[]).map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </form>
      </Modal>

      {/* Neue-Liste-Modal */}
      <Modal
        open={showListForm}
        onClose={() => setShowListForm(false)}
        title="Neue Aufgabenliste"
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
              form="task-list-form"
              disabled={createListMutation.isPending || !listForm.name.trim()}
            >
              Erstellen
            </Btn>
          </>
        }
      >
        <form
          id="task-list-form"
          onSubmit={(e) => {
            e.preventDefault();
            createListMutation.mutate({ name: listForm.name.trim(), color: listForm.color });
          }}
          className="space-y-4"
        >
          <Field label="Name" required>
            <input
              className="input"
              value={listForm.name}
              onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
              maxLength={100}
              placeholder="z. B. Haushalt, Projekt, Einkauf"
            />
          </Field>
          <Field label="Farbe">
            <div className="flex flex-wrap gap-2">
              {LIST_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setListForm({ ...listForm, color: c })}
                  aria-label={`Farbe ${c}`}
                  className={cn(
                    'h-7 w-7 rounded-pill border-2',
                    listForm.color === c ? 'border-ink' : 'border-transparent',
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

interface TaskGroupProps {
  title: string;
  status?: StatusKind;
  tasks: Task[];
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskGroup({ title, status, tasks, onToggle, onEdit, onDelete }: TaskGroupProps) {
  const confirm = useConfirm();
  if (tasks.length === 0) return null;
  const style = status ? STATUS_STYLE[status] : null;
  const GroupIcon = style?.icon;
  return (
    <section aria-label={title}>
      {/* Getönte Kopfzeile mit Icon: der Gruppenstatus hängt nicht allein
          an einem Farbpunkt. */}
      <h2
        className="mb-2 inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em]"
        style={
          style
            ? { background: style.tint, borderColor: style.line, color: style.color }
            : { borderColor: 'var(--line)', color: 'var(--text-3)' }
        }
      >
        {GroupIcon && <GroupIcon className="h-3.5 w-3.5" aria-hidden />}
        {title}
        <span className="tnum">{tasks.length}</span>
      </h2>
      <Card className="divide-y divide-line p-0">
        {tasks.map((task) => (
          <div key={task.id} className="group flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => onToggle(task)}
              aria-label={task.completedAt ? 'Als offen markieren' : 'Als erledigt markieren'}
              className="shrink-0 text-ink-3 transition-colors hover:text-indigo"
            >
              {task.completedAt ? (
                <CheckCircle2 className="h-5 w-5 text-pos" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'truncate text-sm font-medium',
                  task.completedAt ? 'text-ink-3 line-through' : 'text-ink',
                )}
              >
                {task.title}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-3">
                {task.dueAt && <span className="tnum">{formatDate(task.dueAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                {task.recurrence && (
                  <span className="flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    {RECURRENCE_LABEL[task.recurrence]}
                  </span>
                )}
                {task.taskList && (
                  <span className="flex items-center gap-1">
                    <List className="h-3 w-3" />
                    {task.taskList.name}
                  </span>
                )}
                {task.priority !== 'MEDIUM' && (
                  <span className="flex items-center gap-1" style={{ color: PRIORITY_COLOR[task.priority] }}>
                    <Flag className="h-3 w-3" />
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <IconBtn variant="quiet" size="sm" icon={Pencil} aria-label="Bearbeiten" onClick={() => onEdit(task)} />
              <IconBtn
                variant="quiet"
                size="sm"
                icon={Trash2}
                aria-label="Löschen"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Aufgabe löschen?',
                    description: task.title,
                    confirmLabel: 'Löschen',
                    destructive: true,
                  });
                  if (ok) onDelete(task);
                }}
              />
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}


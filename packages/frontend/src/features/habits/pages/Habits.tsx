import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Archive, ArchiveRestore, Check, Flame, Goal, Loader2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { habitsApi } from '@/features/habits/api';
import {
  FREQUENCY_LABEL,
  HABIT_COLORS,
  streakLabel,
  type Habit,
  type HabitFrequency,
} from '@/features/habits/types';
import { cn, parseApiError } from '@/lib/utils';
import { Btn, Card, EmptyState, Field, IconBtn, Modal, PageHead, useConfirm } from '@/components/ui';

/** Die letzten 28 Tage als Datumsschlüssel, älteste zuerst. */
function last28Days(): string[] {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: 28 }, (_, i) =>
    new Date(today - (27 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

const EMPTY_FORM = {
  title: '',
  notes: '',
  frequency: 'DAILY' as HabitFrequency,
  targetPerPeriod: 1,
  color: '',
};

export function HabitsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [showArchived, setShowArchived] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: habits, isLoading } = useQuery({
    queryKey: ['habits', showArchived],
    queryFn: () => habitsApi.getAll({ includeArchived: showArchived }).then((r) => r.data),
  });

  const days = useMemo(last28Days, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['habit-summary'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        notes: form.notes.trim() || undefined,
        frequency: form.frequency,
        targetPerPeriod: form.targetPerPeriod,
        color: form.color || undefined,
      };
      return editing ? habitsApi.update(editing.id, payload) : habitsApi.create(payload);
    },
    onSuccess: () => {
      invalidate();
      closeEditor();
      toast.success(editing ? 'Gewohnheit gespeichert' : 'Gewohnheit angelegt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date?: string }) => habitsApi.toggle(id, date),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Abhaken')),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
      habitsApi.update(id, { isArchived }),
    onSuccess: (_r, v) => {
      invalidate();
      toast.success(v.isArchived ? 'Archiviert' : 'Wieder aktiv');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Archivieren')),
  });

  const deleteMutation = useMutation({
    mutationFn: habitsApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success('Gewohnheit gelöscht');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const openEditor = (habit?: Habit) => {
    setEditing(habit ?? null);
    setForm(
      habit
        ? {
            title: habit.title,
            notes: habit.notes ?? '',
            frequency: habit.frequency,
            targetPerPeriod: habit.targetPerPeriod,
            color: habit.color ?? '',
          }
        : EMPTY_FORM,
    );
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
  };

  const doneToday = habits?.filter((h) => h.doneToday).length ?? 0;
  const active = habits?.filter((h) => !h.isArchived).length ?? 0;

  return (
    <div className="space-y-5">
      <PageHead
        title="Gewohnheiten"
        sub={
          active > 0
            ? `${doneToday} von ${active} für heute erledigt`
            : 'Kleine Routinen, sichtbar gemacht'
        }
        actions={
          <div className="flex gap-2">
            <Btn
              variant={showArchived ? 'primary' : 'ghost'}
              icon={Archive}
              onClick={() => setShowArchived((v) => !v)}
            >
              Archiv
            </Btn>
            <Btn variant="grad" icon={Plus} onClick={() => openEditor()}>
              Neue Gewohnheit
            </Btn>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : (habits?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Goal}
          title="Noch keine Gewohnheiten"
          description="Lesen, Sport, Wasser trinken – lege fest, was du regelmäßig tun willst, und hake es täglich ab."
          action={{ label: 'Gewohnheit anlegen', onClick: () => openEditor(), icon: Plus }}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {habits!.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              days={days}
              busy={toggleMutation.isPending}
              onToggleToday={() => toggleMutation.mutate({ id: habit.id })}
              onToggleDay={(date) => toggleMutation.mutate({ id: habit.id, date })}
              onEdit={() => openEditor(habit)}
              onArchive={() =>
                archiveMutation.mutate({ id: habit.id, isArchived: !habit.isArchived })
              }
              onDelete={async () => {
                const ok = await confirm({
                  title: 'Gewohnheit löschen?',
                  description: `„${habit.title}" und die gesamte Historie werden entfernt.`,
                  confirmLabel: 'Löschen',
                  destructive: true,
                });
                if (ok) deleteMutation.mutate(habit.id);
              }}
            />
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title={editing ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'}
        footer={
          <>
            <Btn variant="ghost" onClick={closeEditor}>
              Abbrechen
            </Btn>
            <Btn
              variant="grad"
              type="submit"
              form="habit-form"
              disabled={saveMutation.isPending || !form.title.trim()}
            >
              Speichern
            </Btn>
          </>
        }
      >
        <form
          id="habit-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.title.trim()) saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Was willst du regelmäßig tun?" required>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
              placeholder="z. B. 30 Minuten lesen"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rhythmus">
              <select
                className="input"
                value={form.frequency}
                onChange={(e) =>
                  setForm({ ...form, frequency: e.target.value as HabitFrequency })
                }
              >
                <option value="DAILY">Täglich</option>
                <option value="WEEKLY">Wöchentlich</option>
              </select>
            </Field>
            <Field label="Ziel je Periode" hint="Wie oft pro Tag bzw. Woche?">
              <input
                type="number"
                className="input"
                min={1}
                max={50}
                value={form.targetPerPeriod}
                onChange={(e) =>
                  setForm({ ...form, targetPerPeriod: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </Field>
          </div>
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
              {HABIT_COLORS.map((c) => (
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
          <Field label="Notiz">
            <textarea
              className="input min-h-[70px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={1000}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function HabitCard({
  habit,
  days,
  busy,
  onToggleToday,
  onToggleDay,
  onEdit,
  onArchive,
  onDelete,
}: {
  habit: Habit;
  days: string[];
  busy: boolean;
  onToggleToday: () => void;
  onToggleDay: (date: string) => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const done = new Set(habit.last30Days);
  const accent = habit.color ?? 'var(--indigo)';

  return (
    <Card
      hover
      className={cn('group flex flex-col gap-3', habit.isArchived && 'opacity-60')}
      style={{ borderTopColor: accent, borderTopWidth: 3 }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleToday}
          disabled={busy || habit.isArchived}
          aria-pressed={habit.doneToday}
          aria-label={habit.doneToday ? 'Für heute wieder öffnen' : 'Für heute abhaken'}
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-pill border-2 transition-colors',
            habit.doneToday
              ? 'border-transparent text-white'
              : 'border-line text-ink-4 hover:border-ink-3 hover:text-ink-2',
            (busy || habit.isArchived) && 'cursor-not-allowed opacity-60',
          )}
          style={habit.doneToday ? { background: accent } : undefined}
        >
          <Check className="h-5 w-5" />
        </button>

        <button onClick={onEdit} className="min-w-0 flex-1 text-left">
          <h3 className="truncate text-sm font-bold text-ink">{habit.title}</h3>
          <p className="text-xs text-ink-3">
            {FREQUENCY_LABEL[habit.frequency]}
            {habit.targetPerPeriod > 1 && ` · ${habit.completedThisPeriod}/${habit.targetPerPeriod}`}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {habit.streak > 0 && (
            <span
              className="mr-1 flex items-center gap-1 rounded-pill bg-soft px-2 py-1 text-[0.7rem] font-bold text-ink-2"
              title={`Aktuelle Serie: ${streakLabel(habit)}`}
            >
              <Flame className="h-3.5 w-3.5 text-peach" />
              <span className="tnum">{habit.streak}</span>
            </span>
          )}
          <IconBtn
            variant="quiet"
            size="sm"
            icon={habit.isArchived ? ArchiveRestore : Archive}
            aria-label={habit.isArchived ? 'Wieder aktivieren' : 'Archivieren'}
            className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
            onClick={onArchive}
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

      {habit.notes && <p className="line-clamp-2 text-xs text-ink-3">{habit.notes}</p>}

      {/* 4-Wochen-Raster: jeder Tag ist einzeln nachtragbar */}
      <div className="flex flex-wrap gap-1">
        {days.map((day) => {
          const hit = done.has(day);
          const label = format(new Date(`${day}T00:00:00.000Z`), 'EEEE, d. MMMM', { locale: de });
          return (
            <button
              key={day}
              onClick={() => onToggleDay(day)}
              disabled={busy || habit.isArchived}
              aria-label={`${label}${hit ? ' – erledigt' : ''}`}
              title={label}
              className={cn(
                'h-4 w-4 rounded-[4px] border transition-colors',
                hit ? 'border-transparent' : 'border-line bg-soft hover:border-ink-4',
                (busy || habit.isArchived) && 'cursor-not-allowed',
              )}
              style={hit ? { background: accent } : undefined}
            />
          );
        })}
      </div>
    </Card>
  );
}

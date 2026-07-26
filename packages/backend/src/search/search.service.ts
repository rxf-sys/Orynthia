import { Injectable } from '@nestjs/common';
import { TasksService } from '../modules/tasks/tasks.service';
import { CalendarService } from '../modules/calendar/calendar.service';
import { RecipesService } from '../modules/recipes/recipes.service';
import { ListsService } from '../modules/lists/lists.service';
import { NotesService } from '../modules/notes/notes.service';
import { TripsService } from '../modules/trips/trips.service';

export interface SearchHit {
  module: 'tasks' | 'calendar' | 'recipes' | 'lists' | 'notes' | 'trips';
  id: string;
  title: string;
  subtitle?: string;
  to: string;
}

/**
 * Modulübergreifende Suche für das Command Center (⌘K).
 *
 * Aggregiert bewusst nur über die schmalen Public-APIs der Module – der
 * Such-Dienst kennt keine Prisma-Modelle und hat insbesondere keinerlei
 * Zugriff auf Finanz-/Banking-Daten (die haben ihre eigene, bestehende
 * Transaktionssuche in der Palette).
 */
@Injectable()
export class SearchService {
  constructor(
    private tasks: TasksService,
    private calendar: CalendarService,
    private recipes: RecipesService,
    private lists: ListsService,
    private notes: NotesService,
    private trips: TripsService,
  ) {}

  async search(userId: string, rawQuery: string, limitPerModule = 4): Promise<SearchHit[]> {
    const q = rawQuery.trim();
    if (q.length < 2) return [];

    const [tasks, events, recipes, listResults, notes, trips] = await Promise.all([
      this.tasks.search(userId, q, limitPerModule),
      this.calendar.search(userId, q, limitPerModule),
      this.recipes.search(userId, q, limitPerModule),
      this.lists.search(userId, q, limitPerModule),
      this.notes.search(userId, q, limitPerModule),
      this.trips.search(userId, q, limitPerModule),
    ]);

    const hits: SearchHit[] = [
      ...tasks.map((t) => ({
        module: 'tasks' as const,
        id: t.id,
        title: t.title,
        subtitle: t.dueAt ? `Fällig ${t.dueAt.toLocaleDateString('de-DE')}` : 'Aufgabe',
        to: '/tasks',
      })),
      ...events.map((e) => ({
        module: 'calendar' as const,
        id: e.id,
        title: e.title,
        subtitle: `${new Date(e.startsAt).toLocaleDateString('de-DE')} · ${e.calendarName}`,
        to: '/calendar',
      })),
      ...recipes.map((r) => ({
        module: 'recipes' as const,
        id: r.id,
        title: r.title,
        subtitle: r.isFavorite ? 'Rezept · Favorit' : 'Rezept',
        to: `/recipes/${r.id}`,
      })),
      ...listResults.lists.map((l) => ({
        module: 'lists' as const,
        id: l.id,
        title: l.name,
        subtitle: 'Liste',
        to: `/lists/${l.id}`,
      })),
      ...listResults.items.map((i) => ({
        module: 'lists' as const,
        id: i.id,
        title: i.name,
        subtitle: `Eintrag in ${i.list.name}`,
        to: `/lists/${i.list.id}`,
      })),
      ...notes.map((n) => ({
        module: 'notes' as const,
        id: n.id,
        title: n.title || n.content.slice(0, 60) || 'Notiz',
        subtitle: 'Notiz',
        to: '/notes',
      })),
      ...trips.map((t) => ({
        module: 'trips' as const,
        id: t.id,
        title: t.title,
        subtitle: [t.destination, t.startDate.toLocaleDateString('de-DE')]
          .filter(Boolean)
          .join(' · '),
        to: `/trips/${t.id}`,
      })),
    ];

    return hits;
  }
}

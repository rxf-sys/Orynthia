import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LinkableType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolvedLink {
  linkId: string;
  type: LinkableType;
  id: string;
  title: string;
  subtitle?: string;
  to: string;
}

/**
 * Generische Verknüpfungen zwischen Alltags-Modulen.
 *
 * Sicherheitsprinzip: Eine Verknüpfung entsteht nur, wenn **beide** Enden
 * dem anfragenden Nutzer gehören – geprüft wird das gegen die jeweilige
 * Tabelle, nicht anhand mitgelieferter IDs. Finanz-Entitäten sind über
 * `LinkableType` bewusst nicht verknüpfbar.
 */
@Injectable()
export class LinksService {
  constructor(private prisma: PrismaService) {}

  /** Prüft Existenz + Ownership und liefert die Anzeigedaten der Entität. */
  private async resolve(
    userId: string,
    type: LinkableType,
    id: string,
  ): Promise<Omit<ResolvedLink, 'linkId'> | null> {
    switch (type) {
      case 'TRIP': {
        const trip = await this.prisma.trip.findFirst({
          where: { id, userId },
          select: { id: true, title: true, destination: true, startDate: true },
        });
        return trip
          ? {
              type,
              id: trip.id,
              title: trip.title,
              subtitle: trip.destination ?? undefined,
              to: `/trips/${trip.id}`,
            }
          : null;
      }
      case 'CALENDAR_EVENT': {
        const event = await this.prisma.calendarEvent.findFirst({
          where: { id, calendar: { userId } },
          select: { id: true, title: true, startsAt: true },
        });
        return event
          ? {
              type,
              id: event.id,
              title: event.title,
              subtitle: event.startsAt.toLocaleDateString('de-DE'),
              to: '/calendar',
            }
          : null;
      }
      case 'TASK': {
        const task = await this.prisma.task.findFirst({
          where: { id, userId },
          select: { id: true, title: true, completedAt: true },
        });
        return task
          ? {
              type,
              id: task.id,
              title: task.title,
              subtitle: task.completedAt ? 'erledigt' : 'offen',
              to: '/tasks',
            }
          : null;
      }
      case 'LIST': {
        const list = await this.prisma.list.findFirst({
          where: { id, userId },
          select: { id: true, name: true, type: true },
        });
        return list
          ? { type, id: list.id, title: list.name, subtitle: list.type, to: `/lists/${list.id}` }
          : null;
      }
      case 'NOTE': {
        const note = await this.prisma.note.findFirst({
          where: { id, userId },
          select: { id: true, title: true, content: true },
        });
        return note
          ? {
              type,
              id: note.id,
              title: note.title || note.content.slice(0, 60) || 'Notiz',
              to: '/notes',
            }
          : null;
      }
      case 'RECIPE': {
        const recipe = await this.prisma.recipe.findFirst({
          where: { id, userId },
          select: { id: true, title: true },
        });
        return recipe
          ? { type, id: recipe.id, title: recipe.title, to: `/recipes/${recipe.id}` }
          : null;
      }
      default:
        return null;
    }
  }

  async create(
    userId: string,
    source: { type: LinkableType; id: string },
    target: { type: LinkableType; id: string },
  ) {
    if (source.type === target.type && source.id === target.id) {
      throw new BadRequestException('Eine Entität kann nicht mit sich selbst verknüpft werden');
    }
    // Beide Enden müssen dem Nutzer gehören
    const [resolvedSource, resolvedTarget] = await Promise.all([
      this.resolve(userId, source.type, source.id),
      this.resolve(userId, target.type, target.id),
    ]);
    if (!resolvedSource || !resolvedTarget) {
      throw new NotFoundException('Verknüpfte Einträge nicht gefunden');
    }

    const existing = await this.prisma.entityLink.findFirst({
      where: {
        userId,
        OR: [
          {
            sourceType: source.type,
            sourceId: source.id,
            targetType: target.type,
            targetId: target.id,
          },
          // Verknüpfungen sind ungerichtet – Gegenrichtung ebenfalls prüfen
          {
            sourceType: target.type,
            sourceId: target.id,
            targetType: source.type,
            targetId: source.id,
          },
        ],
      },
    });
    if (existing) return existing;

    return this.prisma.entityLink.create({
      data: {
        userId,
        sourceType: source.type,
        sourceId: source.id,
        targetType: target.type,
        targetId: target.id,
      },
    });
  }

  /** Alle mit einer Entität verknüpften Einträge (beide Richtungen). */
  async findLinked(
    userId: string,
    type: LinkableType,
    id: string,
  ): Promise<ResolvedLink[]> {
    const links = await this.prisma.entityLink.findMany({
      where: {
        userId,
        OR: [
          { sourceType: type, sourceId: id },
          { targetType: type, targetId: id },
        ],
      },
      take: 200,
    });

    const resolved: ResolvedLink[] = [];
    for (const link of links) {
      const isSource = link.sourceType === type && link.sourceId === id;
      const otherType = isSource ? link.targetType : link.sourceType;
      const otherId = isSource ? link.targetId : link.sourceId;
      const entity = await this.resolve(userId, otherType, otherId);
      // Zwischenzeitlich gelöschte Gegenstücke werden übersprungen und
      // beim nächsten Aufräumen entfernt.
      if (entity) resolved.push({ linkId: link.id, ...entity });
    }
    return resolved;
  }

  async remove(userId: string, linkId: string) {
    const link = await this.prisma.entityLink.findFirst({
      where: { id: linkId, userId },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Verknüpfung nicht gefunden');
    await this.prisma.entityLink.delete({ where: { id: linkId } });
    return { message: 'Verknüpfung entfernt' };
  }

  /** Verwaiste Links einer gelöschten Entität entfernen. */
  async removeAllFor(userId: string, type: LinkableType, id: string) {
    await this.prisma.entityLink.deleteMany({
      where: {
        userId,
        OR: [
          { sourceType: type, sourceId: id },
          { targetType: type, targetId: id },
        ],
      },
    });
  }
}

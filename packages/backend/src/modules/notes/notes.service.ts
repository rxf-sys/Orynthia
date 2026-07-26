import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, opts: { search?: string; tag?: string } = {}) {
    return this.prisma.note.findMany({
      where: {
        userId,
        ...(opts.search
          ? {
              OR: [
                { title: { contains: opts.search, mode: 'insensitive' } },
                { content: { contains: opts.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(opts.tag ? { tags: { has: opts.tag } } : {}),
      },
      // Angepinnte zuerst, dann zuletzt bearbeitet
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 500,
    });
  }

  async findOne(userId: string, id: string) {
    const note = await this.prisma.note.findFirst({ where: { id, userId } });
    if (!note) throw new NotFoundException('Notiz nicht gefunden');
    return note;
  }

  async create(userId: string, dto: CreateNoteDto) {
    return this.prisma.note.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content ?? '',
        tags: dto.tags ?? [],
        color: dto.color,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    await this.findOne(userId, id);
    return this.prisma.note.update({ where: { id }, data: dto });
  }

  async togglePin(userId: string, id: string) {
    const note = await this.findOne(userId, id);
    return this.prisma.note.update({ where: { id }, data: { pinned: !note.pinned } });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.note.delete({ where: { id } });
    return { message: 'Notiz gelöscht' };
  }

  /** Alle vergebenen Tags mit Häufigkeit – für Filter-Chips. */
  async getTags(userId: string) {
    const notes = await this.prisma.note.findMany({ where: { userId }, select: { tags: true } });
    const counts = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  /** Schmale Public API für die globale Suche. */
  async search(userId: string, q: string, limit = 5) {
    return this.prisma.note.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, content: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}

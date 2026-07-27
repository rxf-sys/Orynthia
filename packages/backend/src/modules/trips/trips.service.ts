import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { LinksService } from '../../platform/links/links.service';
import { CreateTripDto, LinkEntityDto, UpdateTripDto } from './dto/trip.dto';

function toDateOnly(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new BadRequestException('Ungültiges Datum');
  return d;
}

@Injectable()
export class TripsService {
  constructor(
    private prisma: PrismaService,
    private links: LinksService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.trip.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      take: 200,
    });
  }

  /** Reise inklusive aller verknüpften Termine, Listen und Notizen. */
  async findOne(userId: string, id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id, userId } });
    if (!trip) throw new NotFoundException('Reise nicht gefunden');
    const linked = await this.links.findLinked(userId, 'TRIP', id);
    return { ...trip, linked };
  }

  async create(userId: string, dto: CreateTripDto) {
    const startDate = toDateOnly(dto.startDate);
    const endDate = toDateOnly(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('Ende darf nicht vor dem Beginn liegen');
    return this.prisma.trip.create({
      data: {
        userId,
        title: dto.title,
        destination: dto.destination,
        startDate,
        endDate,
        budgetAmount: dto.budgetAmount,
        notes: dto.notes,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateTripDto) {
    const trip = await this.prisma.trip.findFirst({ where: { id, userId } });
    if (!trip) throw new NotFoundException('Reise nicht gefunden');

    const startDate = dto.startDate ? toDateOnly(dto.startDate) : trip.startDate;
    const endDate = dto.endDate ? toDateOnly(dto.endDate) : trip.endDate;
    if (endDate < startDate) throw new BadRequestException('Ende darf nicht vor dem Beginn liegen');

    return this.prisma.trip.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.destination !== undefined ? { destination: dto.destination } : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
        ...(dto.budgetAmount !== undefined ? { budgetAmount: dto.budgetAmount } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id, userId }, select: { id: true } });
    if (!trip) throw new NotFoundException('Reise nicht gefunden');
    // Verknüpfungen mit aufräumen; die verknüpften Einträge selbst bleiben.
    await this.links.removeAllFor(userId, 'TRIP', id);
    await this.prisma.trip.delete({ where: { id } });
    return { message: 'Reise gelöscht' };
  }

  // ---------- Verknüpfungen ----------

  async link(userId: string, tripId: string, dto: LinkEntityDto) {
    await this.assertOwnership(userId, tripId);
    await this.links.create(userId, { type: 'TRIP', id: tripId }, { type: dto.type, id: dto.id });
    return this.links.findLinked(userId, 'TRIP', tripId);
  }

  async unlink(userId: string, tripId: string, linkId: string) {
    await this.assertOwnership(userId, tripId);
    await this.links.remove(userId, linkId);
    return this.links.findLinked(userId, 'TRIP', tripId);
  }

  /** Packliste für eine Reise anlegen und direkt verknüpfen. */
  async createPackingList(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, userId } });
    if (!trip) throw new NotFoundException('Reise nicht gefunden');

    let name = `Packliste ${trip.title}`.slice(0, 100);
    for (let i = 2; i < 20; i++) {
      const exists = await this.prisma.list.findFirst({ where: { userId, name } });
      if (!exists) break;
      name = `Packliste ${trip.title} (${i})`.slice(0, 100);
    }

    const list = await this.prisma.list.create({
      data: { userId, name, type: 'PACKING', icon: '🧳' },
    });
    await this.links.create(userId, { type: 'TRIP', id: tripId }, { type: 'LIST', id: list.id });
    return list;
  }

  /** Schmale Public API für die globale Suche. */
  async search(userId: string, q: string, limit = 5) {
    return this.prisma.trip.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { destination: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, destination: true, startDate: true },
      orderBy: { startDate: 'desc' },
      take: limit,
    });
  }

  private async assertOwnership(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, userId },
      select: { id: true },
    });
    if (!trip) throw new NotFoundException('Reise nicht gefunden');
  }
}

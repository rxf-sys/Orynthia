import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LinksService', () => {
  let service: LinksService;

  const mockPrisma = {
    trip: { findFirst: jest.fn() },
    calendarEvent: { findFirst: jest.fn() },
    task: { findFirst: jest.fn() },
    list: { findFirst: jest.fn() },
    note: { findFirst: jest.fn() },
    recipe: { findFirst: jest.fn() },
    entityLink: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LinksService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<LinksService>(LinksService);
    jest.clearAllMocks();
  });

  describe('create – Ownership beider Enden', () => {
    it('legt die Verknüpfung an, wenn beide Enden dem Nutzer gehören', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue({ id: 'trip1', title: 'Italien', destination: 'Rom', startDate: new Date() });
      mockPrisma.list.findFirst.mockResolvedValue({ id: 'list1', name: 'Packliste', type: 'PACKING' });
      mockPrisma.entityLink.findFirst.mockResolvedValue(null);
      mockPrisma.entityLink.create.mockResolvedValue({ id: 'link1' });

      await service.create('u1', { type: 'TRIP', id: 'trip1' }, { type: 'LIST', id: 'list1' });

      expect(mockPrisma.entityLink.create).toHaveBeenCalledTimes(1);
      // Ownership wird gegen die Tabellen geprüft, nicht der ID vertraut
      expect(mockPrisma.trip.findFirst.mock.calls[0][0].where.userId).toBe('u1');
      expect(mockPrisma.list.findFirst.mock.calls[0][0].where.userId).toBe('u1');
    });

    it('verweigert die Verknüpfung, wenn das Ziel einem anderen Nutzer gehört', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue({ id: 'trip1', title: 'Italien', startDate: new Date() });
      mockPrisma.list.findFirst.mockResolvedValue(null); // fremde Liste

      await expect(
        service.create('u1', { type: 'TRIP', id: 'trip1' }, { type: 'LIST', id: 'fremd' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.entityLink.create).not.toHaveBeenCalled();
    });

    it('verweigert die Verknüpfung, wenn die Quelle fremd ist', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue(null);
      mockPrisma.list.findFirst.mockResolvedValue({ id: 'list1', name: 'X', type: 'PACKING' });

      await expect(
        service.create('u1', { type: 'TRIP', id: 'fremd' }, { type: 'LIST', id: 'list1' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.entityLink.create).not.toHaveBeenCalled();
    });

    it('lehnt Selbstverknüpfung ab', async () => {
      await expect(
        service.create('u1', { type: 'NOTE', id: 'n1' }, { type: 'NOTE', id: 'n1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('legt keine Dublette an – auch nicht in Gegenrichtung', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue({ id: 'trip1', title: 'X', startDate: new Date() });
      mockPrisma.note.findFirst.mockResolvedValue({ id: 'n1', title: 'Notiz', content: '' });
      mockPrisma.entityLink.findFirst.mockResolvedValue({ id: 'bestehend' });

      const result = await service.create(
        'u1',
        { type: 'TRIP', id: 'trip1' },
        { type: 'NOTE', id: 'n1' },
      );

      expect(result).toEqual({ id: 'bestehend' });
      expect(mockPrisma.entityLink.create).not.toHaveBeenCalled();
      // Die Abfrage deckt beide Richtungen ab
      expect(mockPrisma.entityLink.findFirst.mock.calls[0][0].where.OR).toHaveLength(2);
    });
  });

  describe('findLinked', () => {
    it('löst Verknüpfungen in beide Richtungen auf', async () => {
      mockPrisma.entityLink.findMany.mockResolvedValue([
        { id: 'l1', sourceType: 'TRIP', sourceId: 'trip1', targetType: 'LIST', targetId: 'list1' },
        { id: 'l2', sourceType: 'NOTE', sourceId: 'note1', targetType: 'TRIP', targetId: 'trip1' },
      ]);
      mockPrisma.list.findFirst.mockResolvedValue({ id: 'list1', name: 'Packliste', type: 'PACKING' });
      mockPrisma.note.findFirst.mockResolvedValue({ id: 'note1', title: 'Hotel-Infos', content: '' });

      const linked = await service.findLinked('u1', 'TRIP', 'trip1');

      expect(linked).toHaveLength(2);
      expect(linked[0]).toMatchObject({ linkId: 'l1', type: 'LIST', title: 'Packliste' });
      // Auch wenn die Reise das Ziel war, wird das Gegenstück aufgelöst
      expect(linked[1]).toMatchObject({ linkId: 'l2', type: 'NOTE', title: 'Hotel-Infos' });
    });

    it('überspringt Verknüpfungen auf zwischenzeitlich gelöschte Einträge', async () => {
      mockPrisma.entityLink.findMany.mockResolvedValue([
        { id: 'l1', sourceType: 'TRIP', sourceId: 'trip1', targetType: 'LIST', targetId: 'weg' },
      ]);
      mockPrisma.list.findFirst.mockResolvedValue(null);

      expect(await service.findLinked('u1', 'TRIP', 'trip1')).toEqual([]);
    });
  });

  describe('remove', () => {
    it('wirft NotFound für fremde Verknüpfungen', async () => {
      mockPrisma.entityLink.findFirst.mockResolvedValue(null);
      await expect(service.remove('u1', 'fremd')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.entityLink.delete).not.toHaveBeenCalled();
    });
  });
});

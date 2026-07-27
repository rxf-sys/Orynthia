import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TripsService } from './trips.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { LinksService } from '../../platform/links/links.service';

describe('TripsService', () => {
  let service: TripsService;

  const mockPrisma = {
    trip: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    list: { findFirst: jest.fn(), create: jest.fn() },
  };

  const mockLinks = {
    create: jest.fn(),
    findLinked: jest.fn().mockResolvedValue([]),
    remove: jest.fn(),
    removeAllFor: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LinksService, useValue: mockLinks },
      ],
    }).compile();

    service = module.get<TripsService>(TripsService);
    jest.clearAllMocks();
    mockLinks.findLinked.mockResolvedValue([]);
  });

  describe('create', () => {
    it('lehnt Ende vor Beginn ab', async () => {
      await expect(
        service.create('u1', { title: 'X', startDate: '2026-08-20', endDate: '2026-08-10' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.trip.create).not.toHaveBeenCalled();
    });

    it('speichert das Budget als reine Planungsgröße', async () => {
      mockPrisma.trip.create.mockResolvedValue({});
      await service.create('u1', {
        title: 'Italien',
        startDate: '2026-08-10',
        endDate: '2026-08-20',
        budgetAmount: 1500,
      });
      expect(mockPrisma.trip.create.mock.calls[0][0].data.budgetAmount).toBe(1500);
    });
  });

  describe('findOne', () => {
    it('liefert die Reise samt aufgelöster Verknüpfungen', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue({ id: 't1', title: 'Italien' });
      mockLinks.findLinked.mockResolvedValue([{ linkId: 'l1', type: 'LIST', title: 'Packliste' }]);

      const result = await service.findOne('u1', 't1');

      expect(result.linked).toHaveLength(1);
      expect(mockLinks.findLinked).toHaveBeenCalledWith('u1', 'TRIP', 't1');
    });

    it('wirft NotFound für fremde Reisen', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue(null);
      await expect(service.findOne('u1', 'fremd')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPackingList', () => {
    it('legt eine Packliste an und verknüpft sie mit der Reise', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue({ id: 't1', title: 'Italien' });
      mockPrisma.list.findFirst.mockResolvedValue(null);
      mockPrisma.list.create.mockResolvedValue({ id: 'list1', name: 'Packliste Italien' });

      const list = await service.createPackingList('u1', 't1');

      expect(mockPrisma.list.create.mock.calls[0][0].data).toMatchObject({
        userId: 'u1',
        name: 'Packliste Italien',
        type: 'PACKING',
      });
      expect(mockLinks.create).toHaveBeenCalledWith(
        'u1',
        { type: 'TRIP', id: 't1' },
        { type: 'LIST', id: 'list1' },
      );
      expect(list.id).toBe('list1');
    });

    it('weicht bei Namenskollision auf einen Suffix aus', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue({ id: 't1', title: 'Italien' });
      mockPrisma.list.findFirst
        .mockResolvedValueOnce({ id: 'vorhanden' })
        .mockResolvedValueOnce(null);
      mockPrisma.list.create.mockResolvedValue({ id: 'list2' });

      await service.createPackingList('u1', 't1');

      expect(mockPrisma.list.create.mock.calls[0][0].data.name).toBe('Packliste Italien (2)');
    });

    it('wirft NotFound für fremde Reisen', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue(null);
      await expect(service.createPackingList('u1', 'fremd')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.list.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('räumt die Verknüpfungen mit auf, lässt die verknüpften Einträge aber bestehen', async () => {
      mockPrisma.trip.findFirst.mockResolvedValue({ id: 't1' });

      await service.remove('u1', 't1');

      expect(mockLinks.removeAllFor).toHaveBeenCalledWith('u1', 'TRIP', 't1');
      expect(mockPrisma.trip.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });
  });
});

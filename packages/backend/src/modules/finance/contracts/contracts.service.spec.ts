import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { NotificationsService } from '../../../platform/notifications/notifications.service';

describe('ContractsService – Kündigungsfristen', () => {
  let service: ContractsService;

  const mockPrisma = {
    contract: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transaction: { findMany: jest.fn(), groupBy: jest.fn() },
  };

  const mockNotifications = { create: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    jest.clearAllMocks();
  });

  it('erinnert an bald ablaufende Kündigungsfristen mit fristgenauem dedupeKey', async () => {
    const deadline = new Date(Date.now() + 10 * 86_400_000);
    mockPrisma.contract.findMany.mockResolvedValue([
      {
        id: 'c1',
        userId: 'u1',
        name: 'Mobilfunk-Vertrag',
        provider: 'Telekom',
        cancellationDate: deadline,
        monthlyCost: 29.95,
      },
    ]);
    mockNotifications.create.mockResolvedValue({});

    await service.notifyUpcomingCancellations();

    expect(mockNotifications.create).toHaveBeenCalledTimes(1);
    const arg = mockNotifications.create.mock.calls[0][0];
    expect(arg.userId).toBe('u1');
    expect(arg.title).toBe('Kündigungsfrist läuft ab');
    expect(arg.message).toContain('Mobilfunk-Vertrag');
    // dedupeKey hängt an der Frist, nicht am Tag → nur eine Meldung je Frist
    expect(arg.dedupeKey).toBe(`contract-cancellation:c1:${deadline.toISOString().slice(0, 10)}`);
    expect(arg.data.contractId).toBe('c1');
  });

  it('fragt nur aktive Verträge im 30-Tage-Fenster ab', async () => {
    mockPrisma.contract.findMany.mockResolvedValue([]);

    await service.notifyUpcomingCancellations();

    const where = mockPrisma.contract.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.cancellationDate.gte).toBeInstanceOf(Date);
    const windowDays =
      (where.cancellationDate.lte.getTime() - where.cancellationDate.gte.getTime()) / 86_400_000;
    expect(Math.round(windowDays)).toBe(30);
    expect(mockNotifications.create).not.toHaveBeenCalled();
  });
});

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SuppliersService } from './suppliers.service.js';
import { Supplier } from './supplier.entity.js';

const userId = '11111111-1111-1111-1111-111111111111';
const createdAt = new Date('2026-10-10T12:00:00.000Z');

describe('SuppliersService', () => {
  const suppliers = {
    find: vi.fn(),
    create: vi.fn((value: Partial<Supplier>) => value),
    save: vi.fn(),
  };

  let service: SuppliersService;

  beforeEach(async () => {
    vi.clearAllMocks();
    suppliers.save.mockImplementation(async (value: Partial<Supplier>) => ({
      id: '22222222-2222-2222-2222-222222222222',
      createdAt,
      updatedAt: createdAt,
      ...value,
    }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: getRepositoryToken(Supplier), useValue: suppliers },
      ],
    }).compile();

    service = moduleRef.get(SuppliersService);
  });

  it("lists the caller's suppliers, newest first", async () => {
    suppliers.find.mockResolvedValue([
      {
        id: '22222222-2222-2222-2222-222222222222',
        userId,
        name: 'Nordwind Hydraulik GmbH',
        country: 'Germany',
        createdAt,
      },
    ]);

    const result = await service.list(userId);

    expect(suppliers.find).toHaveBeenCalledWith({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    expect(result).toEqual({
      suppliers: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Nordwind Hydraulik GmbH',
          country: 'Germany',
          createdAt: '2026-10-10T12:00:00.000Z',
        },
      ],
    });
  });

  it('creates a supplier owned by the caller', async () => {
    const result = await service.create(userId, {
      name: 'Nordwind Hydraulik GmbH',
    });

    expect(suppliers.create).toHaveBeenCalledWith({
      userId,
      name: 'Nordwind Hydraulik GmbH',
      country: null,
    });
    expect(result).toEqual({
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Nordwind Hydraulik GmbH',
      country: null,
      createdAt: '2026-10-10T12:00:00.000Z',
    });
  });
});

import { Test } from '@nestjs/testing';
import { IngredientsService } from './ingredients.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = { ingredient: { findMany: jest.fn() } } as any;

describe('IngredientsService', () => {
  let service: IngredientsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = mod.get(IngredientsService);
  });

  it('maps an ingredient with age-banded references (Decimal→number, ageLabel, source)', async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([
      {
        id: 1,
        name: '비타민D',
        canonicalUnit: '㎍',
        isFatSoluble: true,
        references: [
          {
            ageMinMonths: 72,
            ageMaxMonths: 107,
            recommended: '5',
            upperLimit: '40',
            unit: '㎍',
            source: 'KDRIs 2020',
            sourceUrl: 'http://k',
          },
        ],
      },
    ]);
    const out = await service.list();
    expect(out).toEqual([
      {
        id: 1,
        name: '비타민D',
        canonicalUnit: '㎍',
        isFatSoluble: true,
        references: [
          {
            ageMinMonths: 72,
            ageMaxMonths: 107,
            ageLabel: '만 6–8세',
            recommended: 5,
            upperLimit: 40,
            unit: '㎍',
          },
        ],
        source: 'KDRIs 2020',
        sourceUrl: 'http://k',
      },
    ]);
    expect(typeof out[0].references[0].recommended).toBe('number');
  });

  it('returns an empty references array for ingredients with no KDRIs standard', async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([
      {
        id: 9,
        name: '유산균',
        canonicalUnit: '억CFU',
        isFatSoluble: false,
        references: [],
      },
    ]);
    const out = await service.list();
    expect(out[0].references).toEqual([]);
    expect(out[0].source).toBe('KDRIs 2020 / 식약처');
    expect(out[0].sourceUrl).toBeNull();
  });
});

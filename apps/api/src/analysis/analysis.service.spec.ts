import { Test } from '@nestjs/testing';
import { AnalysisService } from './analysis.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  product: { findMany: jest.fn() },
  ingredient: { findMany: jest.fn() },
  intakeReference: { findMany: jest.fn() },
};

describe('AnalysisService', () => {
  let service: AnalysisService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [AnalysisService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = mod.get(AnalysisService);
  });

  it('returns per-nutrient verdicts from DB data', async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([{ id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true }]);
    prismaMock.intakeReference.findMany.mockResolvedValue([
      { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: '5', upperLimit: '40', unit: '㎍', source: 'KDRIs 2020', sourceUrl: 'http://x' },
    ]);
    prismaMock.product.findMany.mockResolvedValue([
      { id: 10, name: 'A', ingredients: [{ ingredientId: 1, amount: '10', unit: '㎍' }] },
      { id: 11, name: 'B', ingredients: [{ ingredientId: 1, amount: '15', unit: '㎍' }] },
    ]);
    const out = await service.analyze({ ageMonths: 96, sex: null, productIds: [10, 11] });
    expect(out.byNutrient[0].verdict).toBe('DUPLICATE');
    expect(out.disclaimer).toContain('참고용');
  });
});

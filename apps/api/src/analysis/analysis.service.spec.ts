import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { ExplanationService } from './explanation.service';
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
      providers: [
        AnalysisService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ExplanationService,
          useValue: {
            explainAll: jest
              .fn()
              .mockImplementation((items: { ingredientId: number }[]) =>
                Promise.resolve(
                  new Map(items.map((i) => [i.ingredientId, '설명'])),
                ),
              ),
          },
        },
      ],
    }).compile();
    service = mod.get(AnalysisService);
  });

  it('returns per-nutrient verdicts from DB data', async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([
      { id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true },
    ]);
    prismaMock.intakeReference.findMany.mockResolvedValue([
      {
        ingredientId: 1,
        ageMinMonths: 72,
        ageMaxMonths: 107,
        sex: null,
        recommended: '5',
        upperLimit: '40',
        unit: '㎍',
        source: 'KDRIs 2020',
        sourceUrl: 'http://x',
      },
    ]);
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 10,
        name: 'A',
        ingredients: [{ ingredientId: 1, amount: '10', unit: '㎍' }],
      },
      {
        id: 11,
        name: 'B',
        ingredients: [{ ingredientId: 1, amount: '15', unit: '㎍' }],
      },
    ]);
    const out = await service.analyze({
      ageMonths: 96,
      sex: null,
      productIds: [10, 11],
    });
    expect(out.byNutrient[0].verdict).toBe('DUPLICATE');
    expect(out.byNutrient[0].ingredientName).toBe('비타민D');
    expect(out.byNutrient[0].explanation).toBe('설명');
    expect(out.disclaimer).toContain('참고용');
  });

  it('still returns the safety report when the explanation layer fails', async () => {
    // 결정론적 안전 판정은 LLM 설명 실패와 무관하게 살아남아야 한다.
    const mod = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ExplanationService,
          useValue: {
            explainAll: jest.fn().mockRejectedValue(new Error('llm down')),
          },
        },
      ],
    }).compile();
    const svc = mod.get(AnalysisService);
    prismaMock.ingredient.findMany.mockResolvedValue([
      { id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true },
    ]);
    prismaMock.intakeReference.findMany.mockResolvedValue([
      {
        ingredientId: 1,
        ageMinMonths: 72,
        ageMaxMonths: 107,
        sex: null,
        recommended: '5',
        upperLimit: '40',
        unit: '㎍',
        source: 'KDRIs 2020',
        sourceUrl: 'http://x',
      },
    ]);
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 10,
        name: 'A',
        ingredients: [{ ingredientId: 1, amount: '10', unit: '㎍' }],
      },
      {
        id: 11,
        name: 'B',
        ingredients: [{ ingredientId: 1, amount: '15', unit: '㎍' }],
      },
    ]);
    const out = await svc.analyze({
      ageMonths: 96,
      sex: null,
      productIds: [10, 11],
    });
    expect(out.byNutrient[0].verdict).toBe('DUPLICATE');
    expect(typeof out.byNutrient[0].explanation).toBe('string');
  });

  it('throws BadRequestException when a requested product ID does not resolve', async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([]);
    prismaMock.intakeReference.findMany.mockResolvedValue([]);
    // requested [10, 11, 99] but only 10 exists
    prismaMock.product.findMany.mockResolvedValue([
      { id: 10, name: 'A', ingredients: [] },
    ]);
    await expect(
      service.analyze({ ageMonths: 96, sex: null, productIds: [10, 11, 99] }),
    ).rejects.toThrow(BadRequestException);
  });
});

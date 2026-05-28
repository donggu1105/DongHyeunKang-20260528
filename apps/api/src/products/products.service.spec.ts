import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = { product: { findMany: jest.fn() } } as any;

describe('ProductsService', () => {
  let service: ProductsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = mod.get(ProductsService);
  });

  it('maps products to a frontend-friendly catalog with numeric amounts', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 10,
        name: 'A',
        brand: '브랜드',
        form: '정',
        targetAgeLabel: '7세 이상',
        price: '12000',
        sourceUrl: 'http://x',
        imageUrl: 'http://img',
        ingredients: [{ amount: '10', unit: '㎍', ingredient: { name: '비타민D' } }],
      },
    ]);

    const out = await service.list();

    expect(out).toEqual([
      {
        id: 10,
        name: 'A',
        brand: '브랜드',
        form: '정',
        targetAgeLabel: '7세 이상',
        sourceUrl: 'http://x',
        ingredients: [{ name: '비타민D', amount: 10, unit: '㎍' }],
      },
    ]);
    // amount must be a NUMBER (Decimal converted), not the string '10'
    expect(typeof out[0].ingredients[0].amount).toBe('number');
  });
});

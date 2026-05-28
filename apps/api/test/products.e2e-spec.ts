import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ProductsModule } from '../src/products/products.module';
import { ProductsService } from '../src/products/products.service';

describe('GET /products (e2e)', () => {
  let app: INestApplication;
  const stub = {
    list: jest.fn().mockResolvedValue([
      {
        id: 10,
        name: 'A',
        brand: '브랜드',
        form: '정',
        targetAgeLabel: '7세 이상',
        sourceUrl: 'http://x',
        ingredients: [{ name: '비타민D', amount: 10, unit: '㎍' }],
      },
    ]),
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [ProductsModule] })
      .overrideProvider(ProductsService)
      .useValue(stub)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns the catalog', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    expect(res.body).toEqual([
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
  });
});

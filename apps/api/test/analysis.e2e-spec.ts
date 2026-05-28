import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AnalysisModule } from '../src/analysis/analysis.module';
import { AnalysisService } from '../src/analysis/analysis.service';

describe('POST /analyze (e2e)', () => {
  let app: INestApplication;
  const stub = { analyze: jest.fn().mockResolvedValue({ byNutrient: [{ ingredientId: 1, verdict: 'OVER' }], disclaimer: '참고용' }) };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AnalysisModule] })
      .overrideProvider(AnalysisService).useValue(stub).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('returns the analysis report', async () => {
    const res = await request(app.getHttpServer()).post('/analyze').send({ ageMonths: 96, productIds: [10, 11] }).expect(201);
    expect(res.body.byNutrient[0].verdict).toBe('OVER');
  });

  it('rejects an invalid body with 400', async () => {
    await request(app.getHttpServer()).post('/analyze').send({}).expect(400);
  });
});

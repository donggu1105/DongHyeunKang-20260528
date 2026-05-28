import { runAnalysis } from './analyze';
import type { IngredientDef, ProductInput, ReferenceDef } from '../analysis.types';

const vitD: IngredientDef = { id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true };
const refs: ReferenceDef[] = [
  { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: 5, upperLimit: 40, unit: '㎍', source: 'KDRIs 2020', sourceUrl: 'http://x' },
];
const products: ProductInput[] = [
  { productId: 10, name: 'A', amounts: [{ ingredientId: 1, amount: 400, unit: 'IU' }] }, // 10㎍
  { productId: 11, name: 'B', amounts: [{ ingredientId: 1, amount: 15, unit: '㎍' }] },
];

it('produces a grounded per-nutrient result', () => {
  const out = runAnalysis({ ageMonths: 96, sex: null, products, ingredients: [vitD], references: refs });
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({
    ingredientId: 1, totalCanonical: 25, productCount: 2,
    verdict: 'DUPLICATE', percentOfRecommended: 500,
  });
  expect(out[0].reference?.source).toBe('KDRIs 2020');
});

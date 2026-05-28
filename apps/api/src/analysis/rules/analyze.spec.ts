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

it('returns an empty array when there are no products', () => {
  const out = runAnalysis({ ageMonths: 96, sex: null, products: [], ingredients: [vitD], references: refs });
  expect(out).toEqual([]);
});

it('marks an ingredient absent from the ingredients map as UNKNOWN with null total', () => {
  // product references ingredient 99 which has no IngredientDef and no reference
  const unknownProducts: ProductInput[] = [
    { productId: 30, name: 'X', amounts: [{ ingredientId: 99, amount: 10, unit: 'mg' }] },
  ];
  const out = runAnalysis({ ageMonths: 96, sex: null, products: unknownProducts, ingredients: [vitD], references: refs });
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ ingredientId: 99, verdict: 'UNKNOWN', totalCanonical: null });
});

it('judges two distinct ingredients independently in one run', () => {
  const vitC: IngredientDef = { id: 2, name: '비타민C', canonicalUnit: 'mg', isFatSoluble: false };
  const twoRefs: ReferenceDef[] = [
    { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: 5, upperLimit: 40, unit: '㎍', source: 'KDRIs 2020', sourceUrl: null },
    { ingredientId: 2, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: 50, upperLimit: 500, unit: 'mg', source: 'KDRIs 2020', sourceUrl: null },
  ];
  const twoProducts: ProductInput[] = [
    { productId: 40, name: 'D-only', amounts: [{ ingredientId: 1, amount: 800, unit: 'IU' }] }, // 20㎍, single product within UL → SAFE
    { productId: 41, name: 'C-only', amounts: [{ ingredientId: 2, amount: 600, unit: 'mg' }] }, // 600mg > UL 500 → OVER
  ];
  const out = runAnalysis({ ageMonths: 96, sex: null, products: twoProducts, ingredients: [vitD, vitC], references: twoRefs });
  expect(out).toHaveLength(2);
  const byId = new Map(out.map((r) => [r.ingredientId, r]));
  expect(byId.get(1)).toMatchObject({ totalCanonical: 20, productCount: 1, verdict: 'SAFE' });
  expect(byId.get(2)).toMatchObject({ totalCanonical: 600, productCount: 1, verdict: 'OVER' });
});

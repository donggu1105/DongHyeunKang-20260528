import { aggregateByIngredient } from './aggregate';
import type { IngredientDef, ProductInput } from '../analysis.types';

const vitD: IngredientDef = { id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true };
const ings = new Map<number, IngredientDef>([[1, vitD]]);

const products: ProductInput[] = [
  { productId: 10, name: 'A', amounts: [{ ingredientId: 1, amount: 10, unit: '㎍' }] },
  { productId: 11, name: 'B', amounts: [{ ingredientId: 1, amount: 15, unit: '㎍' }] },
];

describe('aggregateByIngredient', () => {
  it('sums canonical amounts and counts products', () => {
    const out = aggregateByIngredient(products, ings);
    expect(out.get(1)).toEqual({ totalCanonical: 25, productCount: 2 });
  });
  it('marks total null when any amount fails to normalize', () => {
    const bad: ProductInput[] = [{ productId: 12, name: 'C', amounts: [{ ingredientId: 1, amount: 5, unit: 'spoons' }] }];
    expect(aggregateByIngredient(bad, ings).get(1)).toEqual({ totalCanonical: null, productCount: 1 });
  });
});

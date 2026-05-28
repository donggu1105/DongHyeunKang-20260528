import type { IngredientDef, ProductInput } from '../analysis.types';
import { toCanonical } from './units';

export type AggRow = { totalCanonical: number | null; productCount: number };

export function aggregateByIngredient(
  products: ProductInput[],
  ingredients: Map<number, IngredientDef>,
): Map<number, AggRow> {
  const out = new Map<number, AggRow>();
  for (const p of products) {
    for (const a of p.amounts) {
      const ing = ingredients.get(a.ingredientId);
      const prev = out.get(a.ingredientId) ?? { totalCanonical: 0, productCount: 0 };
      const conv = ing ? toCanonical(a.amount, a.unit, ing) : null;
      out.set(a.ingredientId, {
        totalCanonical: prev.totalCanonical === null || conv === null ? null : prev.totalCanonical + conv,
        productCount: prev.productCount + 1,
      });
    }
  }
  return out;
}

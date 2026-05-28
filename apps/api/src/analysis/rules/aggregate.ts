import type { IngredientDef, ProductInput } from '../analysis.types';
import { toCanonical } from './units';

export type AggRow = { totalCanonical: number | null; productCount: number };

// 정규화·합산은 곱셈/나눗셈/덧셈을 거치므로 미세한 이진 부동소수 오차가 누적된다
// (예: 0.1 + 0.2 = 0.30000000000000004). 안전 판정(total > UL)이 거짓 양성을 내지
// 않도록 최종 합계를 6자리에서 반올림한다. 1e-16 수준의 noise는 지우되, 라벨 단위
// 스케일(>=0.001)의 실제 차이는 보존된다.
const PRECISION = 6;
const round = (x: number) => Math.round(x * 10 ** PRECISION) / 10 ** PRECISION;

export function aggregateByIngredient(
  products: ProductInput[],
  ingredients: Map<number, IngredientDef>,
): Map<number, AggRow> {
  const out = new Map<number, AggRow>();
  for (const p of products) {
    for (const a of p.amounts) {
      const ing = ingredients.get(a.ingredientId);
      const prev = out.get(a.ingredientId) ?? {
        totalCanonical: 0,
        productCount: 0,
      };
      const conv = ing ? toCanonical(a.amount, a.unit, ing) : null;
      const sum =
        prev.totalCanonical === null || conv === null
          ? null
          : prev.totalCanonical + conv;
      out.set(a.ingredientId, {
        totalCanonical: sum === null ? null : round(sum),
        productCount: prev.productCount + 1,
      });
    }
  }
  return out;
}

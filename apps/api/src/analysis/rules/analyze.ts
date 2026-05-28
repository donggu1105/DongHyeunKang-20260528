import type { IngredientDef, NutrientResult, ProductInput, ReferenceDef, Sex } from '../analysis.types';
import { aggregateByIngredient } from './aggregate';
import { selectReference } from './reference';
import { judge } from './verdict';

export type AnalysisInput = {
  ageMonths: number;
  sex: Sex | null;
  products: ProductInput[];
  ingredients: IngredientDef[];
  references: ReferenceDef[];
};

export function runAnalysis(input: AnalysisInput): NutrientResult[] {
  const ingMap = new Map(input.ingredients.map((i) => [i.id, i]));
  const agg = aggregateByIngredient(input.products, ingMap);
  const results: NutrientResult[] = [];
  for (const [ingredientId, row] of agg) {
    const ing = ingMap.get(ingredientId);
    const refsFor = input.references.filter((r) => r.ingredientId === ingredientId);
    const ref = selectReference(refsFor, input.ageMonths, input.sex);
    const j = judge(row.totalCanonical, row.productCount, ref);
    results.push({
      ingredientId,
      totalCanonical: row.totalCanonical,
      unit: ing?.canonicalUnit ?? '',
      productCount: row.productCount,
      recommended: ref?.recommended ?? null,
      upperLimit: ref?.upperLimit ?? null,
      percentOfRecommended: j.percentOfRecommended,
      verdict: j.verdict,
      reference: ref,
    });
  }
  return results;
}

import type { ReferenceDef, VerdictCode } from '../analysis.types';

export type Judgement = { verdict: VerdictCode; percentOfRecommended: number | null };

export function judge(total: number | null, productCount: number, ref: ReferenceDef | null): Judgement {
  if (ref === null || total === null) return { verdict: 'UNKNOWN', percentOfRecommended: null };
  const pct = ref.recommended ? Math.round((total / ref.recommended) * 100) : null;
  if (ref.upperLimit !== null && total > ref.upperLimit) return { verdict: 'OVER', percentOfRecommended: pct };
  if (productCount >= 2) return { verdict: 'DUPLICATE', percentOfRecommended: pct };
  return { verdict: 'SAFE', percentOfRecommended: pct };
}

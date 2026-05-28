import type { ReferenceDef, VerdictCode } from '../analysis.types';

export type Judgement = {
  verdict: VerdictCode;
  percentOfRecommended: number | null;
};

export function judge(
  total: number | null,
  productCount: number,
  ref: ReferenceDef | null,
): Judgement {
  if (ref === null || total === null)
    return { verdict: 'UNKNOWN', percentOfRecommended: null };
  // 권장량(RDA/AI)이 null 이거나 0 일 때는 비율을 계산하지 않는다.
  // (0 은 "권장치 없음"을 뜻하며, 나눗셈하면 Infinity/NaN 이 된다.)
  const pct =
    ref.recommended !== null && ref.recommended !== 0
      ? Math.round((total / ref.recommended) * 100)
      : null;
  if (ref.upperLimit !== null && total > ref.upperLimit)
    return { verdict: 'OVER', percentOfRecommended: pct };
  if (productCount >= 2)
    return { verdict: 'DUPLICATE', percentOfRecommended: pct };
  return { verdict: 'SAFE', percentOfRecommended: pct };
}

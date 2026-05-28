import type { IngredientDef } from '../analysis.types';

// 질량 단위 → mg 환산
const MASS_TO_MG: Record<string, number> = {
  g: 1000,
  mg: 1,
  mcg: 0.001,
  '㎍': 0.001,
  ug: 0.001,
  µg: 0.001,
};

// IU → canonical 단위 환산 (성분별로 다름). 키는 성분명.
const IU_TO_CANONICAL: Record<string, { unit: string; factor: number }> = {
  비타민D: { unit: '㎍', factor: 0.025 }, // 1 IU = 0.025㎍
  비타민A: { unit: '㎍', factor: 0.3 }, // 1 IU = 0.3㎍ RAE
  비타민E: { unit: 'mg', factor: 0.667 }, // 1 IU = 0.667mg (natural)
};

/** 라벨 표기값을 성분의 canonicalUnit 기준 숫자로 변환. 불가능하면 null. */
export function toCanonical(amount: number, unit: string, ing: IngredientDef): number | null {
  const u = unit.trim();
  if (u === 'IU') {
    const conv = IU_TO_CANONICAL[ing.name];
    if (!conv || conv.unit !== ing.canonicalUnit) return null;
    return amount * conv.factor;
  }
  // 질량 단위: 라벨 단위 → mg → canonical 단위
  const labelToMg = MASS_TO_MG[u];
  const canonToMg = MASS_TO_MG[ing.canonicalUnit];
  if (labelToMg === undefined || canonToMg === undefined) return null;
  return (amount * labelToMg) / canonToMg;
}

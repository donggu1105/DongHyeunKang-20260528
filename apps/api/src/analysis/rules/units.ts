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
// 환산 계수 출처: KDRIs 2020 / IOM(US) 표준 환산값.
// NOTE: 시드 데이터의 성분명(ingredient.name)은 아래 키와 정확히 일치해야 한다
//       (공백·표기 차이 시 lookup 실패 → IU 환산 불가 → null).
// TODO: make IU factors data-driven via an Ingredient column instead of name-keying
const IU_TO_CANONICAL: Record<string, { unit: string; factor: number }> = {
  비타민D: { unit: '㎍', factor: 0.025 }, // 1 IU = 0.025㎍ (IOM/KDRIs)
  비타민A: { unit: '㎍', factor: 0.3 }, // 1 IU = 0.3㎍ RAE (IOM/KDRIs, retinol)
  비타민E: { unit: 'mg', factor: 0.667 }, // 1 IU = 0.667mg α-TE (natural d-α-tocopherol, IOM)
};

/** 라벨 표기값을 성분의 canonicalUnit 기준 숫자로 변환. 불가능하면 null. */
export function toCanonical(amount: number, unit: string, ing: IngredientDef): number | null {
  const u = unit.trim();
  if (u === 'IU') {
    const conv = IU_TO_CANONICAL[ing.name.trim()];
    if (!conv || conv.unit !== ing.canonicalUnit) return null;
    return amount * conv.factor;
  }
  // 질량 단위: 라벨 단위 → mg → canonical 단위 (대소문자 무시; '㎍'/'µg'는 그대로 유지)
  const labelToMg = MASS_TO_MG[u.toLowerCase()];
  const canonToMg = MASS_TO_MG[ing.canonicalUnit.toLowerCase()];
  if (labelToMg === undefined || canonToMg === undefined) return null;
  return (amount * labelToMg) / canonToMg;
}

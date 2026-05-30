// 8개 캐논 성분 — 한 줄 역할(정적 카피, LLM 아님).
export const NUTRIENT_ROLE: Record<string, string> = {
  비타민D: '뼈·면역',
  비타민A: '시력·점막',
  비타민C: '항산화·면역',
  비타민E: '항산화',
  칼슘: '뼈·치아',
  철: '혈액·산소 운반',
  아연: '면역·성장',
  유산균: '장 건강',
};

// 라벨에 IU가 흔한 지방용성 비타민만. 값 = 캐논단위 1당 IU.
const IU_PER_CANONICAL: Record<string, number> = {
  비타민D: 40, // 1㎍ = 40 IU
  비타민A: 3.33, // 1㎍RAE ≈ 3.33 IU
  비타민E: 1.49, // 1mg ≈ 1.49 IU
};

// 캐논 함량 → "X㎍ = Y IU" 도움말. IU 관례 없는 성분은 null.
export function formatIuHelper(name: string, canonicalAmount: number): string | null {
  const per = IU_PER_CANONICAL[name];
  if (per === undefined) {
    return null;
  }
  const iu = Math.round(canonicalAmount * per);
  const unit = name === '비타민E' ? 'mg' : '㎍';
  return `${canonicalAmount}${unit} = ${iu} IU`;
}

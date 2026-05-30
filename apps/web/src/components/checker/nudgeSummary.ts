import type { AnalyzeResponse, NutrientResult } from '@/libs/Api';

const round = (v: number) => Math.round(v * 100) / 100;

// 결과 상단 '🤖 종합' 문단 — 룰 엔진 판정만으로 조합(LLM 호출 없음).
export function composeSummary(
  report: AnalyzeResponse,
  ageYears: number,
  productCount: number,
): string {
  const by = report.byNutrient;
  const head = `구매하신 ${productCount}개 제품을 분석했어요. 만 ${ageYears}세 기준 `;
  const over = by.filter((n) => n.verdict === 'OVER').map((n) => n.ingredientName);
  const dup = by.filter((n) => n.verdict === 'DUPLICATE').map((n) => n.ingredientName);
  const unknown = by.filter((n) => n.verdict === 'UNKNOWN').map((n) => n.ingredientName);

  const parts: string[] = [];
  if (over.length > 0) {
    parts.push(`${over.join(' · ')} 상한 초과 주의`);
  }
  if (dup.length > 0) {
    parts.push(`${dup.join(' · ')} 겹침`);
  }
  if (unknown.length > 0) {
    parts.push(`${unknown.join(' · ')} 기준 없음(확인불가)`);
  }

  if (parts.length === 0) {
    return `${head}모든 성분이 적정 범위예요.`;
  }
  return `${head}확인이 필요해요 — ${parts.join(', ')}.`;
}

// 성분 1줄 표시용 권장/현재 텍스트.
export function formatNutrientLine(n: NutrientResult): { recommended: string; current: string } {
  return {
    recommended:
      n.recommended === null ? '권장 기준 없음' : `권장 ${round(n.recommended)}${n.unit}`,
    current: n.totalCanonical === null ? '-' : `지금 ${round(n.totalCanonical)}${n.unit}`,
  };
}

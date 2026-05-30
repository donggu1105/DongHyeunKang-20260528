import { describe, expect, it } from 'vitest';
import type { AnalyzeResponse, NutrientResult, Verdict } from '@/libs/Api';
import { composeSummary, formatNutrientLine } from './nudgeSummary';

function nutrient(
  name: string,
  verdict: Verdict,
  over: Partial<NutrientResult> = {},
): NutrientResult {
  return {
    ingredientId: 1,
    ingredientName: name,
    totalCanonical: 10,
    unit: '㎍',
    productCount: 1,
    recommended: 10,
    upperLimit: 100,
    percentOfRecommended: 100,
    verdict,
    reference: null,
    explanation: '',
    ...over,
  };
}
const report = (ns: NutrientResult[]): AnalyzeResponse => ({ byNutrient: ns, disclaimer: 'x' });

describe(composeSummary, () => {
  it('모두 SAFE면 적정 범위 문장', () => {
    const s = composeSummary(report([nutrient('비타민C', 'SAFE')]), 5, 2);
    expect(s).toBe('구매하신 2개 제품을 분석했어요. 만 5세 기준 모든 성분이 적정 범위예요.');
  });

  it('OVER 성분은 상한 초과 주의로 명시', () => {
    const s = composeSummary(report([nutrient('비타민D', 'OVER')]), 5, 1);
    expect(s).toContain('확인이 필요해요');
    expect(s).toContain('비타민D 상한 초과 주의');
  });

  it('DUPLICATE / UNKNOWN 각각 표기', () => {
    const s = composeSummary(
      report([nutrient('철', 'DUPLICATE'), nutrient('셀레늄', 'UNKNOWN')]),
      7,
      3,
    );
    expect(s).toContain('철 겹침');
    expect(s).toContain('셀레늄 기준 없음(확인불가)');
  });
});

describe(formatNutrientLine, () => {
  it('recommended=null이면 "권장 기준 없음"', () => {
    const r = formatNutrientLine(nutrient('X', 'UNKNOWN', { recommended: null }));
    expect(r.recommended).toBe('권장 기준 없음');
  });

  it('권장/현재 포맷', () => {
    const r = formatNutrientLine(
      nutrient('비타민C', 'SAFE', { recommended: 35, totalCanonical: 30, unit: 'mg' }),
    );
    expect(r.recommended).toBe('권장 35mg');
    expect(r.current).toBe('지금 30mg');
  });
});
